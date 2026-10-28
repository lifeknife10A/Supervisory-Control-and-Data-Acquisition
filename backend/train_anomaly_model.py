"""
Train the advisory per-mode dynamics envelopes on HEALTHY operation only.
Usage:
    python train_anomaly_model.py                   # synthetic normal cycles only
    python train_anomaly_model.py --csv data/telemetry_log.csv   # plus logged HEALTHY rows
"""

import argparse
import math
import os
import random
from datetime import datetime

try:
    from .anomaly_model import DEFAULT_MODEL_PATH, MODES, AnomalyDetector, RateTracker
    from .telemetry_logger import read_rows
except ImportError:
    from anomaly_model import DEFAULT_MODEL_PATH, MODES, AnomalyDetector, RateTracker
    from telemetry_logger import read_rows


def track(rows_with_dt):
    """Run samples through a RateTracker exactly as the bridge does; group features by mode."""
    tracker, grouped = RateTracker(), {mode: [] for mode in MODES}
    for row, dt in rows_with_dt:
        mode, features = tracker.update(row, dt)
        if features is not None:
            grouped[mode].append(features)
    return grouped


def merge(target, grouped):
    for mode, rows in grouped.items():
        target[mode].extend(rows)


def synthetic_episode(rng, samples=600):
    """One fill/drain hysteresis run with per-episode plant parameters and sensor noise."""
    dt = rng.uniform(0.2, 0.5)
    fill, leak, drain = rng.uniform(1.5, 3.0), rng.uniform(0.0, 1.2), rng.uniform(1.5, 8.0)
    high, low = rng.uniform(68, 78), rng.uniform(28, 40)
    pump_amps, ripple = rng.uniform(1.4, 1.9), rng.uniform(0.0, 0.15)
    temp_base, temp_amp, gas_base = rng.uniform(22, 40), rng.uniform(0, 4), rng.uniform(10, 45)
    tank, pump, valve = rng.uniform(low, high), rng.random() < 0.5, False
    rows = []
    for i in range(samples):
        t = i * dt
        if pump:
            tank += fill * dt
            if tank >= high:
                pump, valve = False, rng.random() < 0.8  # sometimes just idle instead of draining
        else:
            tank -= (drain if valve else leak) * dt
            if tank <= low:
                pump, valve = True, False
        tank = min(max(tank, 0.0), 100.0)
        rows.append(({
            "tank_level": tank + rng.gauss(0, 0.08),
            "temperature": temp_base + temp_amp * math.sin(t * 0.02) + rng.gauss(0, 0.1),
            "gas_ppm": max(0.0, gas_base + 4 * math.cos(t * 0.03) + rng.gauss(0, 1.5)),
            "current_draw": max(0.0, (pump_amps + ripple * math.sin(t * 2) + rng.gauss(0, 0.05))
                                if pump else rng.uniform(0.0, 0.15)),
            "pump_active": pump, "valve_open": valve,
        }, dt))
    return track(rows)


def logged_samples(path):
    """HEALTHY rows from the telemetry CSV with real time steps; non-healthy rows break the run."""
    prev_time = None
    for row in read_rows(path):
        if row["status_class"] != 0:
            prev_time = None
            continue
        now = datetime.fromisoformat(row["timestamp"])
        yield row, (now - prev_time).total_seconds() if prev_time else None
        prev_time = now


def fault_scenarios(rng):
    """Situations the threshold rules call HEALTHY/WARNING but which are physically wrong."""
    base = dict(temperature=30.0, gas_ppm=20.0, valve_open=False)
    def series(make, n=40, dt=0.25):
        mode, rows = next((m, r) for m, r in track((make(i), dt) for i in range(n)).items() if r)
        return mode, rows
    return {
        "dry run (pump ON, level flat, low amps)": series(lambda i: dict(
            base, tank_level=50 + rng.gauss(0, 0.05), current_draw=0.7, pump_active=True)),
        "blocked inlet (pump ON, level flat, normal amps)": series(lambda i: dict(
            base, tank_level=50 + rng.gauss(0, 0.05), current_draw=1.6, pump_active=True)),
        "tank leak (pump OFF, valve closed, level falling fast)": series(lambda i: dict(
            base, tank_level=60 - i * 1.0, current_draw=0.05, pump_active=False)),
        "current with pump OFF (stuck relay / short)": series(lambda i: dict(
            base, tank_level=50 - i * 0.1, current_draw=1.7, pump_active=False)),
        "rapid heating below 50 C warning zone": series(lambda i: dict(
            base, temperature=30 + i * 0.4, tank_level=40 + i * 0.5, current_draw=1.6, pump_active=True)),
    }


def flagged(detector, mode, rows):
    return sum(score > 0 for score in detector.score_many(mode, rows)) / len(rows)


def main():
    parser = argparse.ArgumentParser(description="Train the SCADA anomaly envelopes")
    parser.add_argument("--csv", help="telemetry_log.csv to add logged HEALTHY rows from")
    parser.add_argument("--episodes", type=int, default=40)
    parser.add_argument("--out", default=DEFAULT_MODEL_PATH)
    parser.add_argument("--seed", type=int, default=7)
    args = parser.parse_args()

    from sklearn.covariance import EllipticEnvelope
    import joblib

    rng = random.Random(args.seed)
    train = {mode: [] for mode in MODES}
    for _ in range(args.episodes):
        merge(train, synthetic_episode(rng))
    if args.csv:
        logged = track(logged_samples(args.csv))
        print(f"Added {sum(map(len, logged.values()))} logged HEALTHY samples from {args.csv}")
        merge(train, logged)
    models = {mode: EllipticEnvelope(contamination=0.01, random_state=args.seed).fit(rows)
              for mode, rows in train.items() if rows}
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    joblib.dump(models, args.out)
    print(f"Trained {', '.join(f'{m}={len(train[m])}' for m in models)} samples -> {args.out}")

    detector = AnomalyDetector(models)
    held_out = {mode: [] for mode in MODES}
    for _ in range(5):
        merge(held_out, synthetic_episode(rng))
    for mode, rows in held_out.items():
        if rows and mode in models:
            print(f"  held-out normal {mode:8s} flagged: {flagged(detector, mode, rows):6.1%}")
    for name, (mode, rows) in fault_scenarios(rng).items():
        print(f"  {name:55s} flagged: {flagged(detector, mode, rows):6.1%}")


if __name__ == "__main__":
    main()
