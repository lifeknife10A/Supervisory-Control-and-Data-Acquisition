"""Convert the ESP32 edge gateway's raw /api/telemetry JSON into the bridge's telemetry schema.

LabVIEW can forward the ESP32 response body to POST /api/telemetry unchanged; the bridge
detects it by the `level_cm` key, converts it here, and adds `control_query` to its reply so
LabVIEW can send the interlocked actuator commands straight back to GET <esp32>/api/control?...

Tank geometry is not final yet; set it with environment variables before starting the bridge:
  SCADA_TANK_EMPTY_CM  ultrasonic distance (cm) when the tank is empty   (default 30)
  SCADA_TANK_FULL_CM   ultrasonic distance (cm) when the tank is full    (default 5)
"""

import os

try:
    from .gas_calibration import ppm_from_ratio, ratio_from_sensor_mv
except ImportError:  # uvicorn server:app / LabVIEW script directory
    from gas_calibration import ppm_from_ratio, ratio_from_sensor_mv

TANK_EMPTY_CM = float(os.environ.get("SCADA_TANK_EMPTY_CM", "30"))
TANK_FULL_CM = float(os.environ.get("SCADA_TANK_FULL_CM", "5"))
GAS_PPM_CEILING = 1000.0  # Bridge range limit; saturating there still trips the gas interlock
MIN_SUPPLY_V = 0.5        # Below this the supply sensor is unwired, not a dead supply
ESP32_KEYS = {"level_cm", "water_temp_c", "gas_v", "pump_a"}


def is_esp32_payload(value):
    return isinstance(value, dict) and "level_cm" in value


def level_percent(distance_cm):
    span = TANK_EMPTY_CM - TANK_FULL_CM
    return min(max((TANK_EMPTY_CM - distance_cm) / span * 100.0, 0.0), 100.0)


def distance_cm(level_pct):
    """Inverse of level_percent."""
    return TANK_EMPTY_CM - level_pct / 100.0 * (TANK_EMPTY_CM - TANK_FULL_CM)


def gas_ppm(sensor_v):
    ratio = ratio_from_sensor_mv(sensor_v * 1000.0)
    # No reading (MQ-2 unwired reads 0 V) stays missing so the bridge fails safe.
    return None if ratio is None else min(ppm_from_ratio(ratio), GAS_PPM_CEILING)


def _number(value, name):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"ESP32 field {name} must be a number")
    return float(value)


def from_esp32(raw):
    missing = ESP32_KEYS - raw.keys()
    if missing:
        raise ValueError(f"ESP32 telemetry is missing {sorted(missing)}")
    values = {name: _number(raw[name], name) for name in ESP32_KEYS | {"bus_v"} & raw.keys()}
    supply = values.get("bus_v")
    # amb_temp_c, hum_pct and press_hpa are placeholders in this firmware (no BME280), so they
    # are not passed on: the ML models would treat them as real readings.
    return {
        "tank_level": level_percent(values["level_cm"]),
        "temperature": values["water_temp_c"],
        "gas_ppm": gas_ppm(values["gas_v"]),
        "current_draw": max(values["pump_a"], 0.0),
        "gas_sensor_mv": values["gas_v"] * 1000.0,
        "supply_voltage": supply if supply is not None and supply >= MIN_SUPPLY_V else None,
        **{name: bool(raw[key]) for key, name in
           (("pump", "pump_active"), ("valve", "valve_open"), ("fan", "fan_active")) if key in raw},
    }


def control_query(commands):
    """Query string for the ESP32's GET /api/control, e.g. pump=0&valve=1&fan=1."""
    return "&".join(f"{key}={int(bool(commands[name]))}" for key, name in
                    (("pump", "pump_active"), ("valve", "valve_open"), ("fan", "fan_active")))
