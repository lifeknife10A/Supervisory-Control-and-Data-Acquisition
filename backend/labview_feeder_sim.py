"""
LabVIEW SCADA Telemetry Feeder Simulator
Emulates a LabVIEW VI acquiring physical sensors and streaming data to the SCADA Bridge.
Every fault is injected on top of the normal fill/drain cycle after --onset seconds, so the
bridge's anomaly, fault-classification, pump-health and forecast models can be demoed.
Usage:
    python3 labview_feeder_sim.py                       # Normal operating loop
    python3 labview_feeder_sim.py --fault gas           # Gas leak (concentration ramps up)
    python3 labview_feeder_sim.py --fault temp          # Thermal runaway
    python3 labview_feeder_sim.py --fault tank          # Overflow (fill control fails high)
    python3 labview_feeder_sim.py --fault dry_run       # Pump runs dry: no filling, low current
    python3 labview_feeder_sim.py --fault blockage      # Inlet blocked: no filling, normal current
    python3 labview_feeder_sim.py --fault overload      # Motor jam: high current, weak flow
    python3 labview_feeder_sim.py --fault leak          # Tank leaks while idle
    python3 labview_feeder_sim.py --fault stuck_relay   # Pump keeps running when commanded off
    python3 labview_feeder_sim.py --fault valve_stuck   # Drain valve reports open but stays shut
    python3 labview_feeder_sim.py --wear 0.8            # Worn pump (0 = new, 1 = end of life)
"""

import argparse
import json
import math
import random
import time
import urllib.request

try:
    from .gas_calibration import ratio_from_ppm, sensor_mv_from_ratio
except ImportError:
    from gas_calibration import ratio_from_ppm, sensor_mv_from_ratio

# 127.0.0.1, not localhost: Windows tries IPv6 first and stalls ~2 s per request.
BRIDGE_URL = "http://127.0.0.1:8000/api/telemetry"
FAULTS = ["normal", "gas", "temp", "tank", "dry_run", "blockage", "overload", "leak",
          "stuck_relay", "valve_stuck"]
FILL_RATE, DRAIN_RATE, PUMP_AMPS = 1.6, 2.0, 1.60  # %/s, %/s, A
HIGH_SETPOINT, LOW_SETPOINT = 75.0, 30.0
AMBIENT_TEMP, HUMIDITY, SUPPLY_V = 24.0, 55.0, 12.0


def run_feeder(fault_mode="normal", rate_hz=4.0, onset_s=10.0, wear=0.0):
    interval = 1.0 / rate_hz
    print("=" * 70)
    print("  LABVIEW SCADA MASTER VI SIMULATOR")
    print(f"  Target Bridge URL: {BRIDGE_URL}")
    print(f"  Stream Frequency : {rate_hz} Hz ({interval * 1000:.0f} ms)")
    print(f"  Simulation Mode  : {fault_mode.upper()} (from t={onset_s:.0f}s) | Pump wear {wear:.0%}")
    print("=" * 70)

    rng = random.Random()
    t = 0.0
    tank_level = 50.0
    pump_active = True
    valve_open = False
    fan_active = False
    gas_extra = temp_extra = 0.0
    last = time.monotonic() - interval

    while True:
        # Advance physics by real elapsed time so rates stay physical if requests are slow.
        now = time.monotonic()
        dt, last = now - last, now
        t += dt
        faulty = fault_mode != "normal" and t >= onset_s

        # Plant physics: worn pumps draw more current and deliver less flow.
        fill = FILL_RATE * (1 - 0.55 * wear)
        amps = PUMP_AMPS * (1 + 0.5 * wear)
        drain = DRAIN_RATE
        pump_running = pump_active
        if faulty:
            if fault_mode == "gas":
                gas_extra = min(gas_extra + 10.0 * dt, 320.0)
            elif fault_mode == "temp":
                temp_extra += 0.5 * dt
            elif fault_mode == "dry_run" and pump_active:
                fill, amps = 0.0, amps * 0.55
            elif fault_mode == "blockage" and pump_active:
                fill, amps = 0.1, amps * 0.92
            elif fault_mode == "overload" and pump_active:
                fill, amps = fill * 0.5, amps * 2.0
            elif fault_mode == "stuck_relay":
                pump_running = True
            elif fault_mode == "valve_stuck":
                drain = 0.0
        if pump_running:
            tank_level += fill * dt
        if valve_open and not pump_active:
            tank_level -= drain * dt
        if faulty and fault_mode == "leak" and not pump_active:
            tank_level -= 3.0 * dt
        tank_level = min(max(tank_level, 0.0), 100.0)

        # Hysteresis controller; "tank" fault = the high setpoint is never acted on.
        if pump_active and tank_level >= HIGH_SETPOINT and not (faulty and fault_mode == "tank"):
            pump_active = False
            valve_open = fault_mode != "leak"  # a leaking tank sits idle so the leak shows
        elif not pump_active and tank_level <= LOW_SETPOINT:
            pump_active = True
            valve_open = False

        # Slow ambient drift (a tank of water does not swing 3 C a minute).
        temperature = 28.0 + 3.0 * math.sin(t * 0.01) + temp_extra + rng.gauss(0, 0.05)
        gas_ppm = 18.0 + 4.0 * math.cos(t * 0.02) + gas_extra
        # ACS712 idles near zero when the pump relay is open.
        current_draw = (amps + 0.15 * math.sin(t * 0.5) + rng.gauss(0, 0.03)) if pump_running else 0.05
        sensor_mv = sensor_mv_from_ratio(ratio_from_ppm(gas_ppm, AMBIENT_TEMP, HUMIDITY))

        payload = {
            "tank_level": round(tank_level + rng.gauss(0, 0.05), 2),
            "temperature": round(min(temperature, 125.0), 2),
            "gas_ppm": round(gas_ppm, 1),
            "current_draw": round(max(current_draw, 0.0), 2),
            "pump_active": pump_active,
            "valve_open": valve_open,
            "fan_active": fan_active,
            "ambient_temp": AMBIENT_TEMP,
            "humidity": HUMIDITY,
            "supply_voltage": SUPPLY_V,
            "gas_sensor_mv": round(sensor_mv, 1),
        }

        try:
            req_data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                BRIDGE_URL,
                data=req_data,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=1.5) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                # Bridge v2.1+ returns a flat payload:
                #   {"status_class", "health_label", "recommendation", "data_valid",
                #    "actuator_commands": {...}}
                status_class = result.get("status_class", 0)
                label = result.get("health_label", "OK")

                # Color formatting
                badge = "\033[92m[OK]\033[0m" if status_class == 0 else ("\033[93m[WARN]\033[0m" if status_class == 1 else "\033[91m[TRIP]\033[0m")
                print(f"{badge} T:{t:5.1f}s | Level: {tank_level:5.1f}% | Temp: {temperature:5.1f}°C | Gas: {gas_ppm:5.0f}ppm | Amps: {current_draw:4.2f}A | AI: {label}")

                # Follow actuator feedback from bridge
                acts = result.get("actuator_commands", {})
                pump_active = acts.get("pump_active", pump_active)
                valve_open = acts.get("valve_open", valve_open)
                fan_active = acts.get("fan_active", fan_active)

        except Exception as e:
            print(f"\033[91m[ERROR]\033[0m Could not connect to bridge: {e}")

        time.sleep(interval)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="LabVIEW SCADA Feeder Simulator")
    parser.add_argument("--fault", choices=FAULTS, default="normal", help="Fault scenario")
    parser.add_argument("--rate", type=float, default=4.0, help="Stream rate in Hz (default: 4.0)")
    parser.add_argument("--onset", type=float, default=10.0, help="Seconds of normal running before the fault")
    parser.add_argument("--wear", type=float, default=0.0, help="Pump wear 0-1 (default: 0)")
    args = parser.parse_args()
    try:
        run_feeder(args.fault, args.rate, args.onset, min(max(args.wear, 0.0), 1.0))
    except KeyboardInterrupt:
        print("\n[STOP] Feeder stopped by user.")
