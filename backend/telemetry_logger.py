"""Append-only CSV history of valid telemetry; the training set for the anomaly model."""

import csv
import os

OPTIONAL_FIELDS = ("ambient_temp", "humidity", "pressure_hpa", "supply_voltage", "gas_sensor_mv")
FIELDS = ("timestamp", "tank_level", "temperature", "gas_ppm", "current_draw",
          "pump_active", "valve_open", "fan_active", "status_class", "anomaly_score", *OPTIONAL_FIELDS)
DEFAULT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "telemetry_log.csv")


class TelemetryLogger:
    def __init__(self, path=DEFAULT_PATH):
        self.path = path

    def log(self, state):
        os.makedirs(os.path.dirname(self.path) or ".", exist_ok=True)
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
