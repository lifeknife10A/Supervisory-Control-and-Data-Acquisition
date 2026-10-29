"""In-process correctness checks. No hardware, sockets, or exploit reproduction."""
import unittest
from fastapi.testclient import TestClient
from backend import server
from backend.ml_engine import MLEngine

NORMAL = dict(tank_level=54.2, temperature=29.4, gas_ppm=22.0, current_draw=1.65)


class BridgeTests(unittest.TestCase):
    def setUp(self):
        server.scada_state.clear()
        server.scada_state.update(server.initial_state())
        server.fan_required = False
        server.manual_commands.clear()
        server.connected_websockets.clear()
        server.ml_engine = MLEngine("sim")  # no models, no event log on disk
        server.telemetry_logger = None
        self.client = TestClient(server.app, raise_server_exceptions=False)

    def post(self, **changes):
        return self.client.post('/api/telemetry', json={**NORMAL, **changes}).json()

    def test_valid_and_invalid_health(self):
        self.assertEqual(self.post()['health_label'], 'HEALTHY')
        for body in ('', '{', '[]', '{}', '{"tank_level": 50}'):
            with self.subTest(body=body):
                response = self.client.post('/api/telemetry', content=body)
                self.assertEqual(response.status_code, 200)
                result = response.json()
                self.assertEqual(result['status_class'], 2)
                self.assertEqual(result['health_label'], 'UNKNOWN')
                self.assertFalse(result['data_valid'])
                self.assertFalse(result['actuator_commands']['pump_active'])

    def test_optional_auxiliary_readings(self):
        result = self.post(ambient_temp=24.5, humidity=55.0, pressure=1012.3, voltage=12.1, mq2_mv=180)
        self.assertEqual(result['health_label'], 'HEALTHY')
        state = self.client.get('/api/telemetry').json()
        self.assertEqual((state['ambient_temp'], state['pressure_hpa'], state['supply_voltage']), (24.5, 1012.3, 12.1))
        # Firmware fault sentinel (0x7FFF / 10) on a missing BME280 must not invalidate the plant.
        result = self.post(ambient_temp=3276.7, humidity=3276.7)
        self.assertTrue(result['data_valid'])
        state = self.client.get('/api/telemetry').json()
        self.assertIsNone(state['ambient_temp'])
        self.assertIsNone(state['supply_voltage'])  # not resent, so not stale
        self.assertFalse(self.post(humidity='wet')['data_valid'])

    def test_core_sensor_fault_sentinel_inhibits_pump(self):
        result = self.post(temperature=3276.7, pump_active=True)
        self.assertEqual(result['health_label'], 'UNKNOWN')
        self.assertFalse(result['actuator_commands']['pump_active'])

    def test_interlocks(self):
        result = self.post(tank_level=90, gas_ppm=300, pump_active=True, valve_open=False, fan_active=False)
        self.assertEqual(result['actuator_commands'], dict(pump_active=False, valve_open=True, fan_active=True))
        result = self.client.post('/api/control', json=dict(pump_active=True, valve_open=False, fan_active=False)).json()
        self.assertEqual(result['status'], 'interlocked')
        self.assertFalse(result['controls']['pump_active'])
        self.assertTrue(result['controls']['valve_open'])
        self.assertTrue(result['controls']['fan_active'])

    def test_websocket_shared_ingestion(self):
        with self.client.websocket_connect('/ws/telemetry') as ws:
            self.assertFalse(ws.receive_json()['data_valid'])
            ws.send_json({**NORMAL, 'temperature': 75, 'pump_active': True})
            state = ws.receive_json()
            self.assertEqual(state['status_class'], 2)
            self.assertFalse(state['pump_active'])
            ws.send_text('{')
            self.assertEqual(ws.receive_json()['health_label'], 'UNKNOWN')
            ws.send_json(NORMAL)
            self.assertEqual(ws.receive_json()['health_label'], 'HEALTHY')
        self.assertEqual(server.connected_websockets, [])


    def test_raw_esp32_payload_is_converted_and_returns_control_query(self):
        from backend.esp32_adapter import distance_cm
        from backend.gas_calibration import ratio_from_ppm, sensor_mv_from_ratio
        gas_v = sensor_mv_from_ratio(ratio_from_ppm(20.0)) / 1000.0
        esp = dict(level_cm=distance_cm(50.0), water_temp_c=24.0, amb_temp_c=24.0, press_hpa=1013.2,
                   hum_pct=55.0, gas_pct=0, gas_v=gas_v, bus_v=12.1, pump_a=-0.04,
                   pump=1, valve=0, fan=0, alarm=0)
        result = self.client.post('/api/telemetry', json=esp).json()
        self.assertEqual(result['health_label'], 'HEALTHY')
        self.assertEqual(result['control_query'], 'pump=1&valve=0&fan=0')
        state = self.client.get('/api/telemetry').json()
        self.assertAlmostEqual(state['tank_level'], 50.0, places=3)
        self.assertAlmostEqual(state['gas_ppm'], 20.0, delta=0.5)
        self.assertEqual(state['current_draw'], 0.0)
        self.assertIsNone(state['humidity'])  # firmware placeholder, not passed on
        # Overfull tank: pump interlocked off, drain valve opened.
        result = self.client.post('/api/telemetry', json={**esp, 'level_cm': distance_cm(95.0)}).json()
        self.assertEqual(result['control_query'], 'pump=0&valve=1&fan=0')
        # Unwired MQ-2 (0 V) or a malformed body fails safe with commands LabVIEW can still send.
        for bad in ({**esp, 'gas_v': 0.0}, {'level_cm': 20.0}, {**esp, 'pump_a': 'x'}):
            result = self.client.post('/api/telemetry', json=bad).json()
            self.assertEqual(result['health_label'], 'UNKNOWN')
            self.assertEqual(result['control_query'], 'pump=0&valve=1&fan=1')

    def test_manual_command_is_held_until_the_plant_reports_it(self):
        from backend.esp32_adapter import distance_cm
        from backend.gas_calibration import ratio_from_ppm, sensor_mv_from_ratio
        esp = dict(level_cm=distance_cm(50.0), water_temp_c=24.0, gas_v=sensor_mv_from_ratio(ratio_from_ppm(20.0)) / 1000.0,
                   bus_v=12.1, pump_a=0.0, pump=0, valve=0, fan=0)
        self.client.post('/api/control', json={'pump_active': True})
        # The ESP32 still reports pump=0 on the next poll; the bridge keeps asking for it on.
        self.assertEqual(self.client.post('/api/telemetry', json=esp).json()['control_query'], 'pump=1&valve=0&fan=0')
        # Once applied, the hold clears and the reported state is followed again.
        self.client.post('/api/telemetry', json={**esp, 'pump': 1, 'pump_a': 0.3})
        self.assertEqual(server.manual_commands, {})
        # Interlocks still win over a held command: overfull tank keeps the pump off.
        self.client.post('/api/control', json={'pump_active': True})
        result = self.client.post('/api/telemetry', json={**esp, 'level_cm': distance_cm(95.0)}).json()
        self.assertEqual(result['control_query'], 'pump=0&valve=1&fan=0')

if __name__ == '__main__':
    unittest.main()
