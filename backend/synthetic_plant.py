"""Labelled synthetic plant episodes for training before real data exists.

Each episode runs the fill/drain hysteresis loop with per-episode plant parameters drawn
from a profile (plant_profiles.py), datasheet sensor noise, optional pump wear and one
injected scenario. A fault only changes the physics in the operating modes where it can
physically show (a dry run needs the pump running), and samples are labelled with the
scenario only while it is observable, so labels match what the sensors can see.
"""

import math

try:
    from .gas_calibration import features as gas_features, ratio_from_ppm, sensor_mv_from_ratio
    from .plant_profiles import PROFILES
except ImportError:
    from gas_calibration import features as gas_features, ratio_from_ppm, sensor_mv_from_ratio
    from plant_profiles import PROFILES

SCENARIOS = ("normal", "gas_leak", "overheating", "dry_run", "line_blockage",
             "motor_overload", "tank_leak", "stuck_relay", "valve_stuck")
# None = observable in every mode.
SCENARIO_MODES = {
    "gas_leak": None, "overheating": None,
    "dry_run": {"filling"}, "line_blockage": {"filling"}, "motor_overload": {"filling"},
    "tank_leak": {"idle"}, "stuck_relay": {"idle", "draining"}, "valve_stuck": {"draining"},
}


def _mode(pump, valve):
    return "filling" if pump else ("draining" if valve else "idle")


def simulate_episode(rng, profile, scenario="normal", samples=400, wear=0.0):
    """Return [(sample, dt, label)] for one run; wear in [0, 1] degrades the pump."""
    p = PROFILES[profile]

    def draw(key):
        return rng.uniform(*p[key])

    dt = draw("dt")
    base_amps = draw("pump_amps")
    # Wear: bearing friction raises current, impeller wear lowers delivered flow.
    amps = base_amps * (1 + 0.5 * wear)
    ripple = draw("current_ripple") + 0.08 * base_amps * wear
    fill = draw("fill_rate") * (1 - 0.55 * wear)
    leak, drain, idle_amps = draw("passive_leak"), draw("drain_rate"), draw("idle_amps")
    high, low = rng.uniform(68, 78), rng.uniform(28, 40)
    temp_base, temp_amp, gas_base = draw("temp_base"), rng.uniform(0, 4), draw("gas_base")
    supply, ambient, rh = draw("supply_v"), rng.uniform(5, 40), rng.uniform(25, 90)
    onset = int(samples * rng.uniform(0.2, 0.5))
    severity = {
        "gas_leak": rng.uniform(1, 15),            # ppm/s
        "overheating": rng.uniform(0.05, 0.8),     # C/s
        "dry_run": (rng.uniform(0, 0.15), rng.uniform(0.45, 0.7)),        # fill, amps factors
        "line_blockage": (rng.uniform(0, 0.2), rng.uniform(0.85, 1.0)),
        "motor_overload": (rng.uniform(0.3, 0.8), rng.uniform(1.5, 2.5)),
        "tank_leak": rng.uniform(1.5, 5.0),        # extra %/s
        "valve_stuck": rng.uniform(0, 0.1),        # drain factor
    }.get(scenario)

    tank, pump, valve = rng.uniform(low, high), rng.random() < 0.5, False
    gas_extra = temp_extra = 0.0
    out = []
    for i in range(samples):
        t = i * dt
        active = scenario != "normal" and i >= onset
        modes = SCENARIO_MODES.get(scenario)
        observable = active and (modes is None or _mode(pump, valve) in modes)
        f, a, d, extra_leak, running, noise_gain = fill, amps, drain, 0.0, pump, 1.0
        if observable:
            if scenario in ("dry_run", "line_blockage", "motor_overload"):
                f, a = fill * severity[0], amps * severity[1]
                noise_gain = 3.0 if scenario == "dry_run" else 1.0  # cavitation chatter
            elif scenario == "tank_leak":
                extra_leak = severity
            elif scenario == "stuck_relay":
                running = True
            elif scenario == "valve_stuck":
                d = drain * severity
        if active and scenario == "gas_leak":
            gas_extra += severity * dt
        if active and scenario == "overheating":
            temp_extra += severity * dt

        if running:
            tank += f * dt
        if not pump:
            tank -= (d if valve else leak) * dt
        tank = min(max(tank - extra_leak * dt, 0.0), 100.0)

        if running:
            current = a + ripple * math.sin(t * 2) + rng.gauss(0, p["current_noise"] * noise_gain)
        else:
            current = idle_amps + rng.gauss(0, p["current_noise"] * 0.5)
        temperature = temp_base + temp_amp * math.sin(t * 0.02) + temp_extra + rng.gauss(0, p["temp_noise"])
        gas = gas_base * (1 + 0.1 * math.cos(t * 0.03)) + gas_extra + rng.gauss(0, p["gas_noise"])
        gas = min(max(gas, 0.0), 1000.0)
        sensor_mv = sensor_mv_from_ratio(ratio_from_ppm(max(gas, 0.5), ambient, rh)) * (1 + rng.gauss(0, 0.01))
        sample = {
            "tank_level": min(max(tank + rng.gauss(0, p["tank_noise"]), 0.0), 100.0),
            "temperature": min(temperature, 125.0),
            "gas_ppm": gas,
            "current_draw": min(max(current, 0.0), 5.0),
            "pump_active": pump, "valve_open": valve, "fan_active": gas > 80,
            "ambient_temp": ambient + rng.gauss(0, 0.1), "humidity": rh + rng.gauss(0, 0.5),
            "pressure_hpa": 1013.0, "supply_voltage": supply + rng.gauss(0, 0.05),
            "gas_sensor_mv": sensor_mv,
        }
        out.append((sample, dt, scenario if observable else "normal"))

        # Hysteresis controller acts on the reported actuator states.
        if pump and tank >= high:
            # Sometimes just idle instead of draining; leak runs idle so the leak is observable.
            pump, valve = False, scenario != "tank_leak" and rng.random() < 0.8
        elif not pump and tank <= low:
            pump, valve = True, False
    return out


def mq2_dataset(rng, n):
    """(features, log10 ppm) pairs from the datasheet curve with T/RH effects and 3 % scatter."""
    X, y = [], []
    for _ in range(n):
        ppm = 10 ** rng.uniform(0, 3.7)
        temp, rh = rng.uniform(-10, 50), rng.uniform(20, 90)
        ratio = ratio_from_ppm(ppm, temp, rh) * (1 + rng.gauss(0, 0.03))
        X.append(gas_features(ratio, temp, rh))
        y.append(math.log10(ppm))
    return X, y
