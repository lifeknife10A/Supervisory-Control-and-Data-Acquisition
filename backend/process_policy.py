"""Hardware-independent validation and deterministic process diagnostics."""

import math

SENSOR_RANGES = {
    "tank_level": (0.0, 100.0),
    "temperature": (-55.0, 125.0),
    "gas_ppm": (0.0, 1000.0),
    "current_draw": (0.0, 5.0),
}
ACTUATORS = ("pump_active", "valve_open", "fan_active")
UNKNOWN = (2, "UNKNOWN", "Telemetry unavailable or invalid. Pump inhibited; verify sensors and bridge before restarting.")
# Only explicit aliases: unrelated labels must never be interpreted as sensors.
ALIASES = {
    "tank": "tank_level", "level": "tank_level", "tank_level": "tank_level",
    "temperature": "temperature", "temp": "temperature",
    "gas": "gas_ppm", "gas_ppm": "gas_ppm", "ppm": "gas_ppm",
    "current": "current_draw", "current_draw": "current_draw", "amps": "current_draw",
    **{name: name for name in ACTUATORS},
}


def validate_sensors(values):
    for name, (low, high) in SENSOR_RANGES.items():
        value = values[name]
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError(f"{name} must be a number")
        if not math.isfinite(value) or not low <= value <= high:
            raise ValueError(f"{name} must be finite and within [{low}, {high}]")
    return values


def normalize_payload(value):
    if not isinstance(value, dict):
        raise ValueError("Telemetry must be an object")
    if "Cluster" in value:
        if len(value) != 1 or not isinstance(value["Cluster"], dict):
            raise ValueError("Cluster must wrap one telemetry object")
        value = value["Cluster"]
    result = {}
    for key, item in value.items():
        normalized = key.lower().replace(" ", "_").replace("-", "_")
        name = ALIASES.get(normalized)
        if name is None or name in result:
            raise ValueError(f"Unknown or duplicate telemetry field: {key}")
        result[name] = item
    if not all(name in result for name in SENSOR_RANGES):
        raise ValueError("All four sensor readings are required")
    validate_sensors(result)
    for name in ACTUATORS:
        if name in result and not isinstance(result[name], bool):
            raise ValueError(f"{name} must be a boolean when supplied")
    return result


def evaluate_process_health(tank, temp, gas, current):
    try:
        validate_sensors(dict(zip(SENSOR_RANGES, (tank, temp, gas, current))))
    except (ValueError, TypeError, OverflowError):
        return UNKNOWN
    reasons = []
    if tank >= 88: reasons.append("Tank Overflow Hazard")
    if gas >= 250: reasons.append("Toxic Gas Spike")
    if temp >= 70: reasons.append("Thermal Runaway")
    if current >= 3.8: reasons.append("Motor Overload")
    if reasons:
        return 2, "CRITICAL TRIP (FAULT)", "EMERGENCY SHUTDOWN: " + ", ".join(reasons) + ". Inflow pump interlocked OFF."
    if tank >= 78: reasons.append("Tank High Warning")
    if tank <= 25: reasons.append("Tank Low Warning")
    if gas >= 80: reasons.append("Gas Concentration Elevated")
    if temp >= 50: reasons.append("Elevated Temperature")
    if current >= 2.8: reasons.append("Elevated Motor Current")
    if reasons:
        return 1, "WARNING", "Caution: " + ", ".join(reasons) + ". Inspect process parameters."
    return 0, "HEALTHY", "Nominal process operating conditions. All loops green."
