import json

try:
    from .process_policy import evaluate_process_health
except ImportError:
    from process_policy import evaluate_process_health


def diagnose_telemetry(tank_level, temperature, gas_ppm, current_draw):
    """Return deterministic diagnostics using the bridge's validation and rules."""
    status, label, rec = evaluate_process_health(tank_level, temperature, gas_ppm, current_draw)
    return json.dumps({"status_class": status, "health_label": label,
                       "recommendation": rec, "data_valid": label != "UNKNOWN"})


def get_tuple_output(tank_level, temperature, gas_ppm, current_draw):
    """Preserve (Int32, String, Double, String); 0.0 means no ML confidence available."""
    status, label, rec = evaluate_process_health(tank_level, temperature, gas_ppm, current_draw)
    return status, label, 0.0, rec
