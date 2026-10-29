"""Append-only CSV history of valid telemetry; the training set for the anomaly model."""

import csv
import os
from datetime import datetime

OPTIONAL_FIELDS = ("ambient_temp", "humidity", "pressure_hpa", "supply_voltage", "gas_sensor_mv")
# Model outputs per sample; discrete alert raise/clear events go to alerts.EventLog.
PREDICTION_FIELDS = ("anomaly_score", "iforest_score", "fault_class", "fault_confidence",
                     "pump_health", "gas_ppm_calibrated", "active_alerts")
FIELDS = ("timestamp", "tank_level", "temperature", "gas_ppm", "current_draw",
          "pump_active", "valve_open", "fan_active", "status_class", *PREDICTION_FIELDS, *OPTIONAL_FIELDS)
DEFAULT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "telemetry_log.csv")


class TelemetryLogger:
    def __init__(self, path=DEFAULT_PATH):
        self.path = path
        self.checked = False

    def _rotate_if_schema_changed(self):
        with open(self.path, newline="", encoding="utf-8") as handle:
            header = next(csv.reader(handle), None)
        if header and tuple(header) != FIELDS:
            stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            os.replace(self.path, self.path.replace(".csv", f".{stamp}.csv"))

    def log(self, state):
        os.makedirs(os.path.dirname(self.path) or ".", exist_ok=True)
        if not self.checked and os.path.exists(self.path) and os.path.getsize(self.path) > 0:
            self._rotate_if_schema_changed()
        self.checked = True
        new_file = not os.path.exists(self.path) or os.path.getsize(self.path) == 0
        with open(self.path, "a", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=FIELDS, extrasaction="ignore")
            if new_file:
                writer.writeheader()
            writer.writerow({key: state.get(key) for key in FIELDS})


def read_rows(path=DEFAULT_PATH):
    """Yield logged rows with numeric/boolean fields restored."""
    with open(path, newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            yield {
                "timestamp": row["timestamp"],
                **{key: float(row[key]) for key in ("tank_level", "temperature", "gas_ppm", "current_draw")},
                **{key: row[key] == "True" for key in ("pump_active", "valve_open", "fan_active")},
                "status_class": int(row["status_class"]),
                # Older logs lack these columns; blanks mean the sensor was absent.
                **{key: float(row[key]) if row.get(key) else None for key in OPTIONAL_FIELDS},
            }
