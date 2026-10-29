"""Window-based fault classification and pump health estimation (advisory only).

Both models look at the last WINDOW_SIZE samples (about 5-12 s) instead of one reading,
because faults show up as trends: a dry run is "pump on, level flat, current low" over
several seconds, not one odd number.
  * FaultClassifier  - Random Forest over window statistics -> one of synthetic_plant.SCENARIOS
  * PumpHealthModel  - Gradient Boosting regressor -> health index 0-100 while the pump runs
"""

import logging
import math
import os
from collections import deque

try:
    from .anomaly_model import MAX_RATE_GAP_S
except ImportError:
    from anomaly_model import MAX_RATE_GAP_S

WINDOW_SIZE = 24
FAULT_FEATURES = ("tank_mean", "tank_slope", "temp_mean", "temp_slope", "gas_mean", "gas_slope",
                  "current_mean", "current_std", "current_slope", "pump_frac", "valve_frac")
PUMP_FEATURES = ("current_mean", "current_std", "fill_rate", "fill_per_amp", "supply_voltage")
NOMINAL_SUPPLY_V = 12.0
# Minimum share of the window with the pump on before health is estimated.
PUMP_RUNNING_FRACTION = 0.9
logger = logging.getLogger(__name__)


class SampleWindow:
    """Rolling window of (t, sample); cleared on data gaps so slopes stay meaningful."""

    def __init__(self, size=WINDOW_SIZE):
        self.items = deque(maxlen=size)

    def reset(self):
        self.items.clear()

    def push(self, sample, dt):
        if not self.items:
            t = 0.0
        elif dt is None or not 0 < dt <= MAX_RATE_GAP_S:
            self.items.clear()
            t = 0.0
        else:
            t = self.items[-1][0] + dt
        self.items.append((t, sample))

    @property
    def full(self):
        return len(self.items) == self.items.maxlen

    def values(self, key):
        return [float(s[key]) if s.get(key) is not None else math.nan for _, s in self.items]

    def mean(self, key):
        vals = [v for v in self.values(key) if not math.isnan(v)]
        return sum(vals) / len(vals) if vals else None

    def std(self, key):
        vals = self.values(key)
        m = sum(vals) / len(vals)
        return math.sqrt(sum((v - m) ** 2 for v in vals) / len(vals))

    def slope(self, key):
        """Least-squares rate per second."""
        ts = [t for t, _ in self.items]
        vals = self.values(key)
        tm, vm = sum(ts) / len(ts), sum(vals) / len(vals)
        denom = sum((t - tm) ** 2 for t in ts)
        return sum((t - tm) * (v - vm) for t, v in zip(ts, vals)) / denom if denom else 0.0

    def fraction(self, key):
        return sum(bool(s[key]) for _, s in self.items) / len(self.items)


def fault_features(window):
    return [window.mean("tank_level"), window.slope("tank_level"),
            window.mean("temperature"), window.slope("temperature"),
            window.mean("gas_ppm"), window.slope("gas_ppm"),
            window.mean("current_draw"), window.std("current_draw"), window.slope("current_draw"),
            window.fraction("pump_active"), window.fraction("valve_open")]


def pump_features(window):
    """None unless the pump ran for (almost) the whole window."""
    if not window.full or window.fraction("pump_active") < PUMP_RUNNING_FRACTION:
        return None
    current = window.mean("current_draw")
    fill = window.slope("tank_level")
    supply = window.mean("supply_voltage") or NOMINAL_SUPPLY_V
    return [current, window.std("current_draw"), fill, fill / max(current, 0.01), supply]


def _load(path, what):
    if not os.path.exists(path):
        logger.warning("No %s model at %s; run train_models.py.", what, path)
        return None
    try:
        import joblib
        return joblib.load(path)
    except Exception:
        logger.exception("Could not load %s model.", what)
        return None


class FaultClassifier:
    def __init__(self, model=None):
        self.model = model

    @classmethod
    def load(cls, path):
        return cls(_load(path, "fault classifier"))

    def predict(self, window):
        """{label, confidence, probabilities(top 3)} or None until the window is full."""
        if self.model is None or not window.full:
            return None
        probs = self.model.predict_proba([fault_features(window)])[0]
        ranked = sorted(zip(self.model.classes_, probs), key=lambda kv: -kv[1])
        label, confidence = ranked[0]
        return {"label": str(label), "confidence": round(float(confidence), 3),
                "probabilities": {str(k): round(float(v), 3) for k, v in ranked[:3]}}


def health_label(health):
    if health >= 70:
        return "GOOD"
    return "DEGRADING" if health >= 40 else "SERVICE SOON"


class PumpHealthModel:
    def __init__(self, model=None):
        self.model = model

    @classmethod
    def load(cls, path):
        return cls(_load(path, "pump health"))

    def predict(self, window):
        """{health, label} while the pump runs, else None (caller keeps the last value)."""
        features = pump_features(window) if self.model is not None else None
        if features is None:
            return None
        health = min(max(float(self.model.predict([features])[0]), 0.0), 100.0)
        return {"health": round(health, 1), "label": health_label(health)}
