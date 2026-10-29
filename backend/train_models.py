"""
Train every advisory model on labelled sample data, evaluate it, and save it per profile.
Usage:
    python train_models.py                          # both profiles (sim + rig), synthetic data
    python train_models.py --profile rig --csv data/telemetry_log.csv
                                                    # + logged HEALTHY rows for the anomaly models
    python train_models.py --gas-csv data/mq2_reference.csv
                                                    # + reference gas readings for MQ-2 calibration
                                                    #   (columns: gas_sensor_mv, ambient_temp,
                                                    #    humidity, reference_ppm)
Outputs backend/models/<profile>/{anomaly,fault,pump_health,gas}.joblib and report.json.
"""

import argparse
import csv
import json
import math
import os
import random
import time
from datetime import datetime

try:
    from .anomaly_model import (MAX_RATE_GAP_S, MODES, AnomalyDetector, RateTracker,
                                envelope_features, iforest_features)
    from .gas_calibration import features as gas_features, ppm_from_ratio, ratio_from_sensor_mv, th_factor
    from .ml_engine import MODEL_FILES
    from .plant_profiles import PROFILES, model_dir
    from .predictive_models import SampleWindow, fault_features, pump_features
    from .synthetic_plant import SCENARIOS, mq2_dataset, simulate_episode
    from .telemetry_logger import read_rows
except ImportError:
    from anomaly_model import (MAX_RATE_GAP_S, MODES, AnomalyDetector, RateTracker,
                               envelope_features, iforest_features)
    from gas_calibration import features as gas_features, ppm_from_ratio, ratio_from_sensor_mv, th_factor
    from ml_engine import MODEL_FILES
    from plant_profiles import PROFILES, model_dir
    from predictive_models import SampleWindow, fault_features, pump_features
    from synthetic_plant import SCENARIOS, mq2_dataset, simulate_episode
    from telemetry_logger import read_rows

NORMAL_WEAR, FAULT_WEAR = (0.0, 0.3), (0.0, 0.5)
WINDOW_STRIDE = 3


# --- dataset builders -------------------------------------------------------------------

def episodes(rng, profile, scenario, count, samples, wear):
    return [(simulate_episode(rng, profile, scenario, samples, w), w)
            for w in (rng.uniform(*wear) for _ in range(count))]


def anomaly_rows(runs):
    """Run samples through a RateTracker exactly as the bridge does; split by label."""
    rows = []  # (mode, sample, rates, label)
    for samples in runs:
        tracker = RateTracker()
        for sample, dt, label in samples:
            mode, rates = tracker.update(sample, dt)
            if rates is not None:
                rows.append((mode, sample, rates, label))
    return rows


def window_rows(runs, featurize, stride=WINDOW_STRIDE):
    X, labels = [], []
    for samples in runs:
        window = SampleWindow()
        for i, (sample, dt, label) in enumerate(samples):
            window.push(sample, dt)
            if window.full and i % stride == 0:
                features = featurize(window)
                if features is not None:
                    X.append(features)
                    labels.append(label)
    return X, labels


def logged_runs(path):
    """HEALTHY rows from the telemetry CSV as (sample, dt, 'normal'); unhealthy rows split runs."""
    runs, current, prev_time = [], [], None
    for row in read_rows(path):
        if row["status_class"] != 0:
            if current:
                runs.append(current)
            current, prev_time = [], None
            continue
        now = datetime.fromisoformat(row["timestamp"])
        dt = (now - prev_time).total_seconds() if prev_time else None
        current.append((row, dt if dt and dt <= MAX_RATE_GAP_S else None, "normal"))
        prev_time = now
    if current:
        runs.append(current)
    return runs


def gas_reference(path):
    X, y = [], []
    with open(path, newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            ratio = ratio_from_sensor_mv(float(row["gas_sensor_mv"]))
            if ratio and float(row["reference_ppm"]) > 0:
                X.append(gas_features(ratio, float(row["ambient_temp"]), float(row["humidity"])))
                y.append(math.log10(float(row["reference_ppm"])))
    return X, y


# --- training -----------------------------------------------------------------------------

def train_profile(profile, rng, scale=1.0, csv_path=None, seed=7):
    from sklearn.covariance import EllipticEnvelope
    from sklearn.ensemble import GradientBoostingRegressor, IsolationForest, RandomForestClassifier

    n = lambda count: max(2, int(count * scale))
    normal = [s for s, _ in episodes(rng, profile, "normal", n(40), 600, NORMAL_WEAR)]
    if csv_path:
        logged = logged_runs(csv_path)
        print(f"  + {sum(map(len, logged))} logged HEALTHY samples from {csv_path}")
        normal += logged
    rows = [r for r in anomaly_rows(normal) if r[3] == "normal"]
    envelope = {mode: EllipticEnvelope(contamination=0.01, random_state=seed).fit(
                    [envelope_features(s, r) for m, s, r, _ in rows if m == mode])
                for mode in MODES if any(m == mode for m, *_ in rows)}
    # Stricter than the envelope: unseen-but-healthy plants otherwise look odd to the forest.
    iforest = IsolationForest(n_estimators=200, contamination=0.003, random_state=seed).fit(
        [iforest_features(s, r) for _, s, r, _ in rows])

    fault_runs = [s for scenario in SCENARIOS
                  for s, _ in episodes(rng, profile, scenario, n(30), 400, FAULT_WEAR)]
    X, y = window_rows(fault_runs, fault_features)
    fault = RandomForestClassifier(n_estimators=150, max_depth=16, min_samples_leaf=2,
                                   class_weight="balanced_subsample", n_jobs=-1, random_state=seed).fit(X, y)

    hX, hy = [], []
    for samples, wear in episodes(rng, profile, "normal", n(120), 300, (0.0, 1.0)):
        X_ep, _ = window_rows([samples], pump_features)
        hX += X_ep
        hy += [100 * (1 - wear)] * len(X_ep)
    pump = GradientBoostingRegressor(n_estimators=300, max_depth=3, learning_rate=0.05,
                                     random_state=seed).fit(hX, hy)
    return {"anomaly": {"envelope": envelope, "iforest": iforest}, "fault": fault, "pump_health": pump}, {
        "anomaly_training_samples": len(rows), "fault_training_windows": len(X), "pump_training_windows": len(hX)}


def train_gas(rng, gas_csv=None, seed=7):
    from sklearn.ensemble import GradientBoostingRegressor
    X, y = mq2_dataset(rng, 20000)
    if gas_csv:
        rX, ry = gas_reference(gas_csv)
        print(f"  + {len(rX)} reference gas readings from {gas_csv} (weighted x20)")
        X, y = X + rX * 20, y + ry * 20
    return GradientBoostingRegressor(n_estimators=400, max_depth=3, learning_rate=0.05,
                                     random_state=seed).fit(X, y)


# --- evaluation ---------------------------------------------------------------------------

def evaluate(profile, models, gas_model, rng, scale=1.0):
    detector = AnomalyDetector(models["anomaly"]["envelope"], models["anomaly"]["iforest"])
    n = lambda count: max(2, int(count * scale))
    report = {"anomaly": {}, "fault": {}, "pump_health": {}, "gas": {}}

    for scenario in SCENARIOS:
        runs = [s for s, _ in episodes(rng, profile, scenario, n(8), 400, FAULT_WEAR if scenario != "normal" else NORMAL_WEAR)]
        target = "normal" if scenario == "normal" else scenario
        rows = [r for r in anomaly_rows(runs) if r[3] == target]
        if not rows:
            continue
        hits = {"envelope": 0, "iforest": 0, "combined": 0}
        for mode, sample, rates, _ in rows:
            result = detector.score(mode, sample, rates)
            env = (result["envelope_score"] or 0) > 0
            iso = (result["iforest_score"] or 0) > 0
            hits["envelope"] += env
            hits["iforest"] += iso
            hits["combined"] += env or iso
        key = "false_alarm_rate" if scenario == "normal" else "detection_rate"
        report["anomaly"][scenario] = {k: {key: round(v / len(rows), 3)} for k, v in hits.items()}

    from sklearn.metrics import accuracy_score, classification_report, mean_absolute_error
    runs = [s for scenario in SCENARIOS for s, _ in episodes(rng, profile, scenario, n(8), 400, FAULT_WEAR)]
    X, y = window_rows(runs, fault_features)
    predicted = models["fault"].predict(X)
    per_class = classification_report(y, predicted, output_dict=True, zero_division=0)
    report["fault"] = {"accuracy": round(accuracy_score(y, predicted), 3),
                       "per_class": {c: {k: round(per_class[c][k], 3) for k in ("precision", "recall")}
                                     for c in SCENARIOS if c in per_class}}

    hX, hy = [], []
    for samples, wear in episodes(rng, profile, "normal", n(30), 300, (0.0, 1.0)):
        X_ep, _ = window_rows([samples], pump_features)
        hX += X_ep
        hy += [100 * (1 - wear)] * len(X_ep)
    report["pump_health"] = {"mae_health_points": round(mean_absolute_error(hy, models["pump_health"].predict(hX)), 2)}

    gX, gy = mq2_dataset(rng, 3000)
    truth = [10 ** v for v in gy]
    def mape(pred):
        return round(sum(abs(p - t) / t for p, t in zip(pred, truth)) / len(truth), 3)
    ratios = [10 ** f[0] for f in gX]
    report["gas"] = {
        "mape_uncompensated_formula": mape([ppm_from_ratio(r) for r in ratios]),
        "mape_datasheet_compensation": mape([ppm_from_ratio(r / th_factor(f[1], f[2])) for r, f in zip(ratios, gX)]),
        "mape_model": mape([10 ** v for v in gas_model.predict(gX)]),
    }
    return report


def print_report(profile, report):
    print(f"\n=== {profile} ===")
    print("Anomaly detection (share of samples flagged)")
    print(f"  {'scenario':16s} {'envelope':>9s} {'iforest':>9s} {'combined':>9s}")
    for scenario, result in report["anomaly"].items():
        cells = [next(iter(result[d].values())) for d in ("envelope", "iforest", "combined")]
        tag = " (false alarms)" if scenario == "normal" else ""
        print(f"  {scenario:16s} " + " ".join(f"{c:9.1%}" for c in cells) + tag)
    print(f"Fault classifier accuracy: {report['fault']['accuracy']:.1%}")
    for cls, m in report["fault"]["per_class"].items():
        print(f"  {cls:16s} precision {m['precision']:.2f}  recall {m['recall']:.2f}")
    print(f"Pump health MAE: {report['pump_health']['mae_health_points']} health points (0-100 scale)")
    g = report["gas"]
    print(f"MQ-2 PPM error (MAPE): uncompensated {g['mape_uncompensated_formula']:.1%}, "
          f"datasheet T/RH compensation {g['mape_datasheet_compensation']:.1%}, model {g['mape_model']:.1%}")


def main():
    parser = argparse.ArgumentParser(description="Train the SCADA advisory models")
    parser.add_argument("--profile", choices=[*PROFILES, "all"], default="all")
    parser.add_argument("--csv", help="telemetry_log.csv; HEALTHY rows are added to anomaly training")
    parser.add_argument("--gas-csv", help="MQ-2 reference readings for gas calibration")
    parser.add_argument("--scale", type=float, default=1.0, help="dataset size multiplier")
    parser.add_argument("--out-root", help="directory holding one folder per profile")
    parser.add_argument("--seed", type=int, default=7)
    args = parser.parse_args()
    import joblib

    rng = random.Random(args.seed)
    started = time.time()
    gas_model = train_gas(rng, args.gas_csv, args.seed)
    for profile in (PROFILES if args.profile == "all" else [args.profile]):
        print(f"Training {profile} ...")
        models, sizes = train_profile(profile, rng, args.scale, args.csv, args.seed)
        out = os.path.join(args.out_root, profile) if args.out_root else model_dir(profile)
        os.makedirs(out, exist_ok=True)
        for key, model in {**models, "gas": gas_model}.items():
            joblib.dump(model, os.path.join(out, MODEL_FILES[key]))
        report = evaluate(profile, models, gas_model, random.Random(args.seed + 1000), args.scale)
        report.update(profile=profile, trained_at=datetime.now().isoformat(timespec="seconds"),
                      data="synthetic" + (" + logged" if args.csv else ""), **sizes)
        with open(os.path.join(out, "report.json"), "w", encoding="utf-8") as handle:
            json.dump(report, handle, indent=2)
        print_report(profile, report)
        print(f"Saved -> {out}")
    print(f"\nDone in {time.time() - started:.0f} s")


if __name__ == "__main__":
    main()
