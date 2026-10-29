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


if __name__ == '__main__':
    unittest.main()
