"""Advisory anomaly scoring of plant dynamics. Never drives actuators or status_class.

Two detectors, both trained on HEALTHY operation only:
  * envelope  - one robust-covariance envelope (Mahalanobis distance) per operating mode
                over pump current and tank/temperature rates. Most plant faults are only
                abnormal *given* the actuator state (a flat level is normal while idle but
                a dry run while filling), and faults usually push a reading beyond anything
                seen in training, which a distance model flags reliably.
  * iforest   - an Isolation Forest over the full 8-signal vector, a second opinion for
                unusual *combinations* of in-range readings. On its own it misses
                out-of-range faults (trees cannot isolate points past the training edge),
                which is why it complements rather than replaces the envelope.
Absolute limits stay with the deterministic rules in process_policy.py.
"""

import logging
import os

ENVELOPE_FEATURES = ("current_draw", "tank_rate", "temp_rate")
IFOREST_FEATURES = ("tank_level", "temperature", "gas_ppm", "current_draw",
                    "pump_active", "valve_open", "tank_rate", "temp_rate")
MODES = ("filling", "draining", "idle")
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
        """Return (mode, (tank_rate, temp_rate)), or (mode, None) until a rate is known in this mode."""
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
        return mode, self.rates


def envelope_features(sample, rates):
    return [float(sample["current_draw"]), *rates]


def iforest_features(sample, rates):
    return [float(sample["tank_level"]), float(sample["temperature"]), float(sample["gas_ppm"]),
            float(sample["current_draw"]), float(bool(sample["pump_active"])),
            float(bool(sample["valve_open"])), *rates]


class AnomalyDetector:
    """Holds {"envelope": {mode: model}, "iforest": model}; either part may be missing."""

    def __init__(self, envelope=None, iforest=None):
        self.envelope = envelope or {}
        self.iforest = iforest

    @classmethod
    def load(cls, path):
        if not os.path.exists(path):
            logger.warning("No anomaly model at %s; run train_models.py. Scoring disabled.", path)
            return cls()
        try:
            import joblib
            bundle = joblib.load(path)
            return cls(bundle.get("envelope"), bundle.get("iforest"))
        except Exception:
            logger.exception("Could not load anomaly model; scoring disabled.")
            return cls()

    @property
    def available(self):
        return bool(self.envelope) or self.iforest is not None

    @staticmethod
    def _scores(model, rows):
        # decision_function is positive for inliers; flip so larger means more unusual.
        return [-float(v) for v in model.decision_function(rows)]

    def envelope_scores(self, mode, rows):
        return self._scores(self.envelope[mode], rows)

    def iforest_scores(self, rows):
        return self._scores(self.iforest, rows)

    def score(self, mode, sample, rates):
        """Per-detector scores (> 0 is anomalous) and the combined flag; None when unscorable."""
        result = {"score": None, "detected": None, "envelope_score": None, "iforest_score": None}
        if rates is None:
            return result
        flags = []
        if mode in self.envelope:
            value = self.envelope_scores(mode, [envelope_features(sample, rates)])[0]
            result["envelope_score"] = round(value, 3)
            flags.append(value > 0)
        if self.iforest is not None:
            value = self.iforest_scores([iforest_features(sample, rates)])[0]
            result["iforest_score"] = round(value, 4)
            flags.append(value > 0)
        if flags:
            result["detected"] = any(flags)
            result["score"] = result["envelope_score"] if result["envelope_score"] is not None else result["iforest_score"]
        return result
