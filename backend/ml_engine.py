"""Per-sample orchestration of every advisory model plus alerting.

The bridge calls process() with each valid sample (after the deterministic health rules,
before interlocks rewrite actuators) and invalid() when telemetry is rejected. Nothing
here feeds enforce_safety or status_class.
"""

import os
import time

try:
    from .alerts import AlertManager, now_iso
    from .anomaly_model import AnomalyDetector, RateTracker
    from .forecaster import TrendForecaster
    from .gas_calibration import GasCalibrator
    from .plant_profiles import active_profile, model_dir
    from .predictive_models import FaultClassifier, PumpHealthModel, SampleWindow
except ImportError:
    from alerts import AlertManager, now_iso
    from anomaly_model import AnomalyDetector, RateTracker
    from forecaster import TrendForecaster
    from gas_calibration import GasCalibrator
    from plant_profiles import active_profile, model_dir
    from predictive_models import FaultClassifier, PumpHealthModel, SampleWindow

MODEL_FILES = {"anomaly": "anomaly.joblib", "fault": "fault.joblib",
               "pump_health": "pump_health.joblib", "gas": "gas.joblib"}
FAULT_MIN_CONFIDENCE = 0.6
PUMP_HEALTH_ALERT = 40.0
FORECAST_ALERT_S = 120.0
FAULTS = {
    "gas_leak": ("critical", "Gas concentration rising: possible leak"),
    "overheating": ("critical", "Temperature rising abnormally: possible thermal runaway"),
    "motor_overload": ("critical", "Pump current far above normal with reduced flow: motor overload or jam"),
    "stuck_relay": ("critical", "Current and filling while the pump is commanded off: stuck relay"),
    "dry_run": ("warning", "Pump running with low current and no filling: dry run or cavitation"),
    "line_blockage": ("warning", "Pump running at normal current but tank not filling: inlet or line blockage"),
    "tank_leak": ("warning", "Tank level falling with pump off and valve closed: leak"),
    "valve_stuck": ("warning", "Drain valve open but level not falling: valve stuck"),
}
FORECAST_NAMES = {"tank_level": "Tank level", "temperature": "Temperature", "gas_ppm": "Gas concentration"}
ADVISORY_KINDS_EXCLUDED = {"safety_trip", "rule_warning", "data_invalid"}


class MLEngine:
    def __init__(self, profile=None, anomaly=None, fault=None, pump_health=None, gas=None,
                 event_log=None, clock=time.monotonic):
        self.profile = profile or active_profile()
        self.anomaly = anomaly or AnomalyDetector()
        self.fault = fault or FaultClassifier()
        self.pump_health = pump_health or PumpHealthModel()
        self.gas = gas or GasCalibrator()
        self.alerts = AlertManager(event_log)
        self.clock = clock
        self.rate_tracker, self.window, self.forecaster = RateTracker(), SampleWindow(), TrendForecaster()
        self.last_ingest = None
        self.last_pump_health = None

    @classmethod
    def load(cls, profile=None, event_log=None, directory=None):
        profile = profile or active_profile()
        directory = directory or model_dir(profile)
        path = {key: os.path.join(directory, name) for key, name in MODEL_FILES.items()}
        return cls(profile, AnomalyDetector.load(path["anomaly"]), FaultClassifier.load(path["fault"]),
                   PumpHealthModel.load(path["pump_health"]), GasCalibrator.load(path["gas"]), event_log)

    def model_status(self):
        return {"profile": self.profile, "anomaly_envelope": bool(self.anomaly.envelope),
                "anomaly_iforest": self.anomaly.iforest is not None,
                "fault_classifier": self.fault.model is not None,
                "pump_health": self.pump_health.model is not None,
                "gas_calibration": "model" if self.gas.model is not None else "datasheet"}

    def reset(self):
        self.rate_tracker.reset()
        self.window.reset()
        self.forecaster.reset()
        self.last_ingest = None

    def _dt(self):
        now = self.clock()
        dt = None if self.last_ingest is None else now - self.last_ingest
        self.last_ingest = now
        return dt

    def process(self, state):
        """Return (predictions, newly raised alerts) for one valid sample."""
        dt = self._dt()
        mode, rates = self.rate_tracker.update(state, dt)
        anomaly = self.anomaly.score(mode, state, rates)
        self.window.push(state, dt)
        fault = self.fault.predict(self.window)
        # A fault is not wear: only re-estimate health while the plant looks normal.
        health = self.pump_health.predict(self.window) if not fault or fault["label"] == "normal" else None
        if health is not None:
            self.last_pump_health = {**health, "updated_at": now_iso()}
        gas = self.gas.predict(state.get("gas_sensor_mv"), state.get("ambient_temp"), state.get("humidity"))
        forecast = self.forecaster.update(state, dt)

        detections = {}
        if anomaly["detected"]:
            detections["anomaly"] = ("warning", f"Unusual plant dynamics while {mode}",
                                     {k: anomaly[k] for k in ("envelope_score", "iforest_score")})
        if fault and fault["label"] in FAULTS and fault["confidence"] >= FAULT_MIN_CONFIDENCE:
            severity, message = FAULTS[fault["label"]]
            detections[f"fault:{fault['label']}"] = (severity, message, {"confidence": fault["confidence"]})
        if self.last_pump_health and self.last_pump_health["health"] < PUMP_HEALTH_ALERT:
            detections["pump_health"] = ("warning", f"Pump health {self.last_pump_health['health']:.0f}%: schedule service",
                                         {"health": self.last_pump_health["health"]})
        for key, entry in (forecast or {}).items():
            # Only once past the warning limit: a linear trend cannot know the fill
            # controller stops at its setpoint, so earlier ETAs are shown but not alerted.
            if (key in FORECAST_NAMES and entry["eta_warning_s"] == 0 and entry["eta_trip_s"]
                    and entry["eta_trip_s"] <= FORECAST_ALERT_S):
                detections[f"forecast:{key}"] = (
                    "warning", f"{FORECAST_NAMES[key]} predicted to reach its trip limit in {entry['eta_trip_s']:.0f} s",
                    {"eta_trip_s": entry["eta_trip_s"], "rate_per_min": entry["rate_per_min"]})
        if state["status_class"] == 2:
            detections["safety_trip"] = ("critical", state["recommendation"], {})
        elif state["status_class"] == 1:
            detections["rule_warning"] = ("info", state["recommendation"], {})
        raised = self.alerts.update(detections)

        predictions = {"operating_mode": mode, "anomaly": anomaly, "fault": fault,
                       "pump_health": self.last_pump_health, "gas": gas, "forecast": forecast,
                       "models": self.model_status()}
        return predictions, raised

    def invalid(self):
        self.reset()
        return self.alerts.update({"data_invalid": (
            "critical", "Telemetry invalid or a sensor is faulty; pump inhibited", {})})

    def advisory_text(self):
        messages = [a["message"] for a in self.alerts.active_list() if a["kind"] not in ADVISORY_KINDS_EXCLUDED]
        if not messages:
            return ""
        more = f" (+{len(messages) - 1} more)" if len(messages) > 1 else ""
        return f" Advisory: {messages[0]}{more}."
