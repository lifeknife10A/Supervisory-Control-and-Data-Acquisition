"""
LabVIEW Python Node Script for Inline SCADA Diagnostics
Called directly from LabVIEW's "Call Python Function.vi" (Connectivity -> Python)
"""

import json

def diagnose_telemetry(tank_level: float, temperature: float, gas_ppm: float, current_draw: float) -> str:
    """
    Called by LabVIEW to return a JSON diagnostic string.
    """
    status_class = 0
    label = "HEALTHY"
    rec = "Nominal operation"

    if tank_level >= 88.0 or gas_ppm >= 250.0 or temperature >= 70.0 or current_draw >= 3.8:
        status_class = 2
        label = "CRITICAL TRIP"
        rec = "EMERGENCY SHUTDOWN REQUIRED"
    elif tank_level >= 78.0 or tank_level <= 25.0 or gas_ppm >= 80.0 or temperature >= 50.0 or current_draw >= 2.8:
        status_class = 1
        label = "WARNING"
        rec = "Caution: Elevated operating parameters"

    return json.dumps({
        "status_class": status_class,
        "health_label": label,
        "recommendation": rec
    })

def get_tuple_output(tank_level: float, temperature: float, gas_ppm: float, current_draw: float):
    """
    Returns a native Python tuple directly convertible into a LabVIEW Cluster:
    (Int32 status_class, String health_label, Double confidence, String recommendation)
    """
    if tank_level >= 88.0 or gas_ppm >= 250.0 or temperature >= 70.0 or current_draw >= 3.8:
        return (2, "CRITICAL TRIP", 99.4, "Emergency Trip Interlock Engaged")
    elif tank_level >= 78.0 or tank_level <= 25.0 or gas_ppm >= 80.0 or temperature >= 50.0 or current_draw >= 2.8:
        return (1, "WARNING", 89.7, "Elevated Parameter - Safety Loop Active")
    else:
        return (0, "HEALTHY", 98.2, "Process Loops Operating Nominally")
