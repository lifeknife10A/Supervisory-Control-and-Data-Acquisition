"""
LabVIEW SCADA Telemetry Feeder Simulator
Emulates a LabVIEW VI acquiring physical sensors and streaming data to the SCADA Bridge
Usage:
    python3 labview_feeder_sim.py               # Normal operating loop
    python3 labview_feeder_sim.py --fault gas   # Toxic gas spike scenario
    python3 labview_feeder_sim.py --fault temp  # Thermal runaway scenario
    python3 labview_feeder_sim.py --fault tank  # High tank overflow scenario
"""

import urllib.request
import urllib.parse
import json
import time
import math
import sys
import argparse

BRIDGE_URL = "http://localhost:8000/api/telemetry"

def run_feeder(fault_mode="normal", rate_hz=4.0):
    interval = 1.0 / rate_hz
    print("=" * 70)
    print("  LABVIEW SCADA MASTER VI SIMULATOR")
    print(f"  Target Bridge URL: {BRIDGE_URL}")
    print(f"  Stream Frequency : {rate_hz} Hz ({interval * 1000:.0f} ms)")
    print(f"  Simulation Mode  : {fault_mode.upper()}")
    print("=" * 70)

    t = 0.0
    tank_level = 50.0
    pump_active = True
    valve_open = False
    fan_active = False

    while True:
        t += interval

        # Physics Simulation
        if fault_mode == "normal":
            # Normal fill & drain cycle
            if pump_active:
                tank_level += 0.4
                if tank_level >= 75.0:
                    pump_active = False
                    valve_open = True
            elif valve_open:
                tank_level -= 0.5
                if tank_level <= 30.0:
                    pump_active = True
                    valve_open = False

            temperature = 28.0 + 3.0 * math.sin(t * 0.1)
            gas_ppm = 18.0 + 4.0 * math.cos(t * 0.15)
            current_draw = 1.60 + (0.15 * math.sin(t * 0.5) if pump_active else 0.0)

        elif fault_mode == "gas":
            # High gas leak scenario
            tank_level = 55.0
            temperature = 31.0
            gas_ppm = min(10.0 + t * 15.0, 320.0)
            current_draw = 1.65

        elif fault_mode == "temp":
            # Thermal runaway scenario
            tank_level = 60.0
            temperature = min(30.0 + t * 3.5, 85.0)
            gas_ppm = 25.0
            current_draw = 1.80

        elif fault_mode == "tank":
            # Overflow scenario
            tank_level = min(50.0 + t * 4.0, 96.0)
            temperature = 29.0
            gas_ppm = 20.0
            current_draw = 1.70
            pump_active = True

        payload = {
            "tank_level": round(tank_level, 2),
            "temperature": round(temperature, 2),
            "gas_ppm": round(gas_ppm, 1),
            "current_draw": round(current_draw, 2),
            "pump_active": pump_active,
            "valve_open": valve_open,
            "fan_active": fan_active,
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
                health = result.get("health", {})
                status_class = health.get("status_class", 0)
                label = health.get("label", "OK")

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
    parser.add_argument("--fault", choices=["normal", "gas", "temp", "tank"], default="normal", help="Fault scenario")
    parser.add_argument("--rate", type=float, default=4.0, help="Stream rate in Hz (default: 4.0)")
    args = parser.parse_args()
    try:
        run_feeder(args.fault, args.rate)
    except KeyboardInterrupt:
        print("\n[STOP] Feeder stopped by user.")
