"""Advisory anomaly scoring of plant dynamics. Never drives actuators or status_class.

One robust-covariance envelope (Mahalanobis distance) per operating mode, because most
plant faults are only abnormal *given* the actuator state: a flat tank level is normal
while idle but means a dry run or blocked inlet while filling. Absolute limits stay with
the deterministic rules in process_policy.py; this model watches how the plant moves.
"""

import logging
import os

FEATURES = ("current_draw", "tank_rate", "temp_rate")
MODES = ("filling", "draining", "idle")
DEFAULT_MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models", "anomaly_envelope.joblib")
# Samples further apart than this are treated as a fresh start (no rate information).
MAX_RATE_GAP_S = 5.0
RATE_SMOOTHING = 0.3
logger = logging.getLogger(__name__)


def operating_mode(sample):
    if sample["pump_active"]:
        return "filling"
    return "draining" if sample["valve_open"] else "idle"


class RateTracker:
    """Smoothed per-second tank/temperature rates; restarts on mode change or a data gap."""

    def __init__(self):
        self.reset()

    def reset(self):
        self.previous = self.mode = self.rates = None

    def update(self, sample, dt):
        """Return (mode, feature vector), or (mode, None) until a rate is known in this mode."""
        mode = operating_mode(sample)
        fresh = self.previous is None or mode != self.mode or dt is None or not 0 < dt <= MAX_RATE_GAP_S
        if fresh:
            self.rates = None
        else:
            raw = ((sample["tank_level"] - self.previous["tank_level"]) / dt,
                   (sample["temperature"] - self.previous["temperature"]) / dt)
            self.rates = raw if self.rates is None else tuple(
                old + RATE_SMOOTHING * (new - old) for old, new in zip(self.rates, raw))
        self.previous, self.mode = sample, mode
        if self.rates is None:
            return mode, None
        return mode, [float(sample["current_draw"]), *self.rates]


class AnomalyDetector:
    """Wraps {mode: fitted outlier model}; scores are None when no model is available."""

    def __init__(self, models=None):
        self.models = models or {}

    @classmethod
    def load(cls, path=DEFAULT_MODEL_PATH):
        if not os.path.exists(path):
            logger.warning("No anomaly model at %s; run train_anomaly_model.py. Scoring disabled.", path)
            return cls()
        try:
            import joblib
            return cls(joblib.load(path))
        except Exception:
            logger.exception("Could not load anomaly model; scoring disabled.")
            return cls()

    @property
    def available(self):
        return bool(self.models)

    def score_many(self, mode, rows):
        """Anomaly scores for rows in one mode; > 0 means anomalous."""
        # decision_function is positive for inliers; flip so larger means more unusual.
        return [-float(v) for v in self.models[mode].decision_function(rows)]

    def score(self, mode, features):
        """Return (anomaly_score, anomaly_detected), or (None, None) when unscorable."""
        if features is None or mode not in self.models:
            return None, None
        value = self.score_many(mode, [features])[0]
        return round(value, 3), value > 0
