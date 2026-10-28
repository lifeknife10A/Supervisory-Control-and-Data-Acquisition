"""Advisory anomaly scoring and telemetry history. No hardware or sockets."""
import os
import random
import tempfile
import unittest
from fastapi.testclient import TestClient
from sklearn.covariance import EllipticEnvelope
from backend import server
from backend.anomaly_model import MODES, AnomalyDetector
from backend.telemetry_logger import TelemetryLogger, read_rows
from backend.train_anomaly_model import merge, synthetic_episode

NORMAL = dict(tank_level=50.0, temperature=29.4, gas_ppm=22.0, current_draw=0.05,
              pump_active=False, valve_open=False, fan_active=False)


def small_detector():
    rng, train = random.Random(1), {mode: [] for mode in MODES}
    for _ in range(8):
        merge(train, synthetic_episode(rng))
    return AnomalyDetector({mode: EllipticEnvelope(contamination=0.01, random_state=1).fit(rows)
                            for mode, rows in train.items()})


class AnomalyBridgeTests(unittest.TestCase):
    detector = None

    @classmethod
    def setUpClass(cls):
        cls.detector = small_detector()

    def setUp(self):
        server.scada_state.clear()
        server.scada_state.update(server.initial_state())
        server.fan_required = False
        server.connected_websockets.clear()
        server.rate_tracker.reset()
        server.last_ingest = None
        self.tick = 0.0
        server.clock = self.fake_clock
        server.anomaly_detector = self.detector
        self.tmp = tempfile.TemporaryDirectory()
        self.log_path = os.path.join(self.tmp.name, "history.csv")
        server.telemetry_logger = TelemetryLogger(self.log_path)
        self.client = TestClient(server.app, raise_server_exceptions=False)

    def tearDown(self):
        server.telemetry_logger = None
        self.tmp.cleanup()

    def fake_clock(self):
        self.tick += 0.25
        return self.tick

    def post(self, **changes):
        return self.client.post('/api/telemetry', json={**NORMAL, **changes}).json()

    def test_idle_plant_is_not_flagged(self):
        for i in range(20):
            self.post(tank_level=50.0 - i * 0.05)
        state = self.client.get('/api/telemetry').json()
        self.assertEqual(state['operating_mode'], 'idle')
        self.assertFalse(state['anomaly_detected'])

    def test_stuck_relay_is_advisory_only(self):
        for i in range(20):
            result = self.post(tank_level=50.0 - i * 0.05, current_draw=1.7)
        state = self.client.get('/api/telemetry').json()
        self.assertTrue(state['anomaly_detected'])
        self.assertGreater(state['anomaly_score'], 0)
        # Rules still say healthy and nothing is interlocked; only the text gains an advisory.
        self.assertEqual(result['status_class'], 0)
        self.assertIn('Advisory', result['recommendation'])
        self.assertEqual(set(result), {'status_class', 'health_label', 'recommendation',
                                       'data_valid', 'actuator_commands'})
        self.assertEqual(result['actuator_commands'], dict(pump_active=False, valve_open=False, fan_active=False))

    def test_invalid_telemetry_clears_score(self):
        for _ in range(5):
            self.post()
        self.client.post('/api/telemetry', content='{')
        state = self.client.get('/api/telemetry').json()
        self.assertIsNone(state['anomaly_score'])
        self.assertIsNone(state['anomaly_detected'])

    def test_no_model_leaves_scores_empty(self):
        server.anomaly_detector = AnomalyDetector()
        for _ in range(5):
            self.post()
        state = self.client.get('/api/telemetry').json()
        self.assertEqual(state['health_label'], 'HEALTHY')
        self.assertIsNone(state['anomaly_score'])

    def test_history_logs_valid_samples_only(self):
        self.post()
        self.client.post('/api/telemetry', content='{')
        self.post(pump_active=True, current_draw=1.6)
        rows = list(read_rows(self.log_path))
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]['status_class'], 0)
        self.assertTrue(rows[1]['pump_active'])


if __name__ == '__main__':
    unittest.main()
