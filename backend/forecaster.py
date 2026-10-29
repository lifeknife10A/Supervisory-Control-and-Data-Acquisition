"""Short-horizon trend forecasts: where each process value is heading and when it trips.

A least-squares line over the recent window gives a rate; the time-to-threshold uses the
same warning/trip limits as process_policy.evaluate_process_health. Linear extrapolation
is deliberately simple and explainable; it is advisory and never drives actuators.
"""

try:
    from .predictive_models import SampleWindow
    from .process_policy import SENSOR_RANGES
except ImportError:
    from predictive_models import SampleWindow
    from process_policy import SENSOR_RANGES

FORECAST_WINDOW = 60
FORECAST_HORIZON_S = 60.0
MIN_SPAN_S = 5.0
MAX_ETA_S = 900.0
# direction -> (warning, trip) limits; rising values trip high, the tank also warns low.
LIMITS = {
    "tank_level": {"high": (78.0, 88.0), "low": (25.0, None)},
    "temperature": {"high": (50.0, 70.0)},
    "gas_ppm": {"high": (80.0, 250.0)},
}
# Below these rates a value is treated as steady (sensor noise, not a trend).
MIN_RATE = {"tank_level": 0.02, "temperature": 0.005, "gas_ppm": 0.05}


def _eta(value, rate, limit, rising):
    if limit is None:
        return None
    if (value >= limit) if rising else (value <= limit):
        return 0.0
    if (rate <= 0) if rising else (rate >= 0):
        return None
    eta = (limit - value) / rate
    return round(eta, 1) if eta <= MAX_ETA_S else None


class TrendForecaster:
    def __init__(self, size=FORECAST_WINDOW):
        self.window = SampleWindow(size)

    def reset(self):
        self.window.reset()

    def update(self, sample, dt):
        self.window.push(sample, dt)
        items = self.window.items
        if len(items) < 3 or items[-1][0] - items[0][0] < MIN_SPAN_S:
            return None
        result = {}
        for key, limits in LIMITS.items():
            value = float(sample[key])
            rate = self.window.slope(key)
            if abs(rate) < MIN_RATE[key]:
                rate = 0.0
            low, high = SENSOR_RANGES[key]
            entry = {"value": round(value, 2), "rate_per_min": round(rate * 60, 2),
                     "predicted": round(min(max(value + rate * FORECAST_HORIZON_S, low), high), 2),
                     "eta_warning_s": None, "eta_trip_s": None}
            for direction, (warn, trip) in limits.items():
                rising = direction == "high"
                eta_warn, eta_trip = _eta(value, rate, warn, rising), _eta(value, rate, trip, rising)
                # Report the nearer of the high/low thresholds the value is approaching.
                if eta_warn is not None and (entry["eta_warning_s"] is None or eta_warn < entry["eta_warning_s"]):
                    entry["eta_warning_s"] = eta_warn
                if eta_trip is not None and (entry["eta_trip_s"] is None or eta_trip < entry["eta_trip_s"]):
                    entry["eta_trip_s"] = eta_trip
            result[key] = entry
        result["horizon_s"] = FORECAST_HORIZON_S
        return result
