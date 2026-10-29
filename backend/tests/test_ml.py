"""Advisory ML layer: detections, debounced alerts, event log, forecasts. No hardware or sockets."""
import csv
import os
import random
import tempfile
import unittest
from fastapi.testclient import TestClient
from backend import server
from backend.alerts import AlertManager, EventLog
from backend.anomaly_model import AnomalyDetector
from backend.gas_calibration import GasCalibrator, ratio_from_ppm, sensor_mv_from_ratio
from backend.ml_engine import MLEngine
from backend.predictive_models import FaultClassifier, PumpHealthModel
from backend.synthetic_plant import SCENARIOS
from backend.telemetry_logger import FIELDS, TelemetryLogger, read_rows
from backend.train_models import train_profile

IDLE = dict(tank_level=50.0, temperature=29.4, gas_ppm=22.0, current_draw=0.05,
            pump_active=False, valve_open=False, fan_active=False)
MODELS = {}


def setUpModule():
    models, _ = train_profile("sim", random.Random(3), scale=0.08, seed=3)
    MODELS.update(models)


class MLBridgeTests(unittest.TestCase):
    def setUp(self):
        server.scada_state.clear()
        server.scada_state.update(server.initial_state())
        server.fan_required = False
        server.connected_websockets.clear()
        self.tmp = tempfile.TemporaryDirectory()
        self.events_path = os.path.join(self.tmp.name, "events.csv")
        self.log_path = os.path.join(self.tmp.name, "history.csv")
        self.tick = 0.0
        server.ml_engine = self.engine()
        server.telemetry_logger = TelemetryLogger(self.log_path)
        self.client = TestClient(server.app, raise_server_exceptions=False)

    def tearDown(self):
        server.telemetry_logger = None
        self.tmp.cleanup()

    def engine(self, trained=True):
        anomaly = MODELS["anomaly"] if trained else {}
        return MLEngine("sim", AnomalyDetector(anomaly.get("envelope"), anomaly.get("iforest")),
                        FaultClassifier(MODELS["fault"] if trained else None),
                        PumpHealthModel(MODELS["pump_health"] if trained else None),
                        GasCalibrator(), EventLog(self.events_path), clock=self.fake_clock)

    def fake_clock(self):
        self.tick += 0.25
        return self.tick

    def post(self, **changes):
        return self.client.post('/api/telemetry', json={**IDLE, **changes}).json()

    def state(self):
        return self.client.get('/api/telemetry').json()

    def events(self):
        with open(self.events_path, newline='', encoding='utf-8') as handle:
            return list(csv.DictReader(handle))

    def test_idle_plant_raises_nothing(self):
        for i in range(30):
            self.post(tank_level=50.0 - i * 0.05)
        state = self.state()
        self.assertEqual(state['operating_mode'], 'idle')
        self.assertEqual(state['alerts'], [])
        self.assertIn(state['predictions']['fault']['label'], SCENARIOS)

    def test_stuck_relay_alert_is_debounced_logged_and_advisory_only(self):
        for i in range(30):
            result = self.post(tank_level=50.0 + i * 0.5, current_draw=1.7)
        kinds = {a['kind'] for a in self.state()['alerts']}
        self.assertIn('anomaly', kinds)
        raised = [e for e in self.events() if e['event'] == 'raised']
        self.assertIn('anomaly', {e['kind'] for e in raised})
        # Rules still say healthy and nothing is interlocked; only the text gains an advisory.
        self.assertEqual(result['status_class'], 0)
        self.assertIn('Advisory', result['recommendation'])
        self.assertEqual(set(result), {'status_class', 'health_label', 'recommendation',
                                       'data_valid', 'actuator_commands'})
        self.assertEqual(result['actuator_commands'], dict(pump_active=False, valve_open=False, fan_active=False))
        api = self.client.get('/api/alerts').json()
        self.assertTrue(any(a['kind'] == 'anomaly' for a in api['active']))

    def test_single_odd_sample_does_not_alert(self):
        for _ in range(10):
            self.post()
        self.post(current_draw=1.7)
        for _ in range(3):
            self.post()
        self.assertNotIn('anomaly', {a['kind'] for a in self.state()['alerts']})

    def test_invalid_telemetry_alerts_immediately_and_clears(self):
        for _ in range(5):
            self.post()
        self.client.post('/api/telemetry', content='{')
        state = self.state()
        self.assertIsNone(state['predictions'])
        self.assertIn('data_invalid', {a['kind'] for a in state['alerts']})
        self.post()
        self.assertNotIn('data_invalid', {a['kind'] for a in self.state()['alerts']})
        self.assertEqual([e['event'] for e in self.events() if e['kind'] == 'data_invalid'], ['raised', 'cleared'])

    def test_safety_trip_is_logged(self):
        self.post(temperature=75.0)
        self.assertIn('safety_trip', {e['kind'] for e in self.events()})

    def test_forecast_shows_eta_but_alerts_only_past_warning(self):
        for i in range(40):
            self.post(tank_level=50.0 + i * 0.6, pump_active=True, current_draw=1.6)
        forecast = self.state()['predictions']['forecast']['tank_level']
        self.assertGreater(forecast['rate_per_min'], 0)
        self.assertIsNotNone(forecast['eta_trip_s'])  # still below 78 %: shown, not alerted
        self.assertNotIn('forecast:tank_level', {a['kind'] for a in self.state()['alerts']})
        for i in range(20):
            self.post(tank_level=79.0 + i * 0.3, pump_active=True, current_draw=1.6)
        self.assertIn('forecast:tank_level', {a['kind'] for a in self.state()['alerts']})

    def test_no_models_still_reports_forecast_and_gas(self):
        server.ml_engine = self.engine(trained=False)
        mv = sensor_mv_from_ratio(ratio_from_ppm(100.0, 30.0, 60.0))
        for _ in range(30):
            self.post(gas_sensor_mv=mv, ambient_temp=30.0, humidity=60.0)
        predictions = self.state()['predictions']
        self.assertIsNone(predictions['anomaly']['detected'])
        self.assertIsNone(predictions['fault'])
        self.assertIsNotNone(predictions['forecast'])
        self.assertAlmostEqual(predictions['gas']['ppm_calibrated'], 100.0, delta=1.0)
        self.assertTrue(predictions['gas']['compensated'])

    def test_history_has_prediction_columns(self):
        for _ in range(30):
            self.post()
        rows = list(read_rows(self.log_path))
        self.assertEqual(len(rows), 30)
        with open(self.log_path, newline='', encoding='utf-8') as handle:
            last = list(csv.DictReader(handle))[-1]
        self.assertTrue(last['fault_class'])


class UnitTests(unittest.TestCase):
    def test_alert_manager_debounce(self):
        manager = AlertManager(raise_after=3, clear_after=2)
        detection = {'x': ('warning', 'msg', {})}
        self.assertEqual(manager.update(detection), [])
        manager.update(detection)
        self.assertEqual(len(manager.update(detection)), 1)
        manager.update({})
        self.assertEqual(len(manager.active), 1)
        manager.update({})
        self.assertEqual(manager.active, {})
        self.assertEqual([e['event'] for e in manager.recent()], ['cleared', 'raised'])

    def test_telemetry_log_rotates_old_schema(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, 'log.csv')
            with open(path, 'w', encoding='utf-8') as handle:
                handle.write('timestamp,tank_level\n2026-01-01T00:00:00,1\n')
            TelemetryLogger(path).log({'timestamp': 'now'})
            with open(path, encoding='utf-8') as handle:
                self.assertEqual(handle.readline().strip(), ','.join(FIELDS))
            self.assertEqual(len(os.listdir(tmp)), 2)


if __name__ == '__main__':
    unittest.main()
