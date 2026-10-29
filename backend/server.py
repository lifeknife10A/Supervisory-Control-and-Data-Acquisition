"""In-memory LabVIEW HTTP/WebSocket bridge; no direct hardware I/O."""

import json
import logging
import os
from datetime import datetime, timezone
from typing import Optional

import uvicorn
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, StrictBool

try:
    from .process_policy import (ACTUATORS, OPTIONAL_RANGES, SENSOR_RANGES, UNKNOWN,
                                 normalize_payload, evaluate_process_health)
    from .alerts import EventLog
    from .ml_engine import MLEngine
    from .telemetry_logger import TelemetryLogger
except ImportError:  # uvicorn server:app / LabVIEW script directory
    from process_policy import (ACTUATORS, OPTIONAL_RANGES, SENSOR_RANGES, UNKNOWN,
                                normalize_payload, evaluate_process_health)
    from alerts import EventLog
    from ml_engine import MLEngine
    from telemetry_logger import TelemetryLogger

app = FastAPI(title="SCADA LabVIEW Telemetry Bridge", version="2.2.0")
logger = logging.getLogger(__name__)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])


class ControlCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")
    pump_active: Optional[StrictBool] = None
    valve_open: Optional[StrictBool] = None
    fan_active: Optional[StrictBool] = None


def initial_state():
    return {
        **{name: None for name in SENSOR_RANGES},
        **{name: None for name in OPTIONAL_RANGES},
        "pump_active": False, "valve_open": False, "fan_active": True,
        "status_class": UNKNOWN[0], "health_label": UNKNOWN[1],
        "recommendation": UNKNOWN[2], "data_valid": False,
        "operating_mode": None, "anomaly_score": None, "anomaly_detected": None,
        "predictions": None, "alerts": [],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def _csv_target(env_name, factory):
    # <ENV>=off disables the file; any other value is the CSV path.
    setting = os.environ.get(env_name)
    return None if setting == "off" else factory(setting) if setting else factory()


scada_state = initial_state()
connected_websockets = []
# Safety demand is independent of manual/reported fan state.
fan_required = False
telemetry_logger = _csv_target("SCADA_TELEMETRY_LOG", TelemetryLogger)
# Advisory ML only: its output never feeds enforce_safety or status_class.
ml_engine = MLEngine.load(event_log=_csv_target("SCADA_EVENT_LOG", EventLog))


def response_payload(state):
    return {**{key: state[key] for key in
               ("status_class", "health_label", "recommendation", "data_valid")},
            "actuator_commands": {key: state[key] for key in ACTUATORS}}


def enforce_safety(state):
    if not state["data_valid"]:
        state["pump_active"] = False
        state["fan_active"] = True
        return
    if state["status_class"] == 2:
        state["pump_active"] = False
    if state["tank_level"] >= 88:
        state["valve_open"] = True
    if fan_required:
        state["fan_active"] = True


def mark_unknown():
    # Keep last readings for inspection, but explicitly invalidate their health.
    ml_engine.invalid()
    scada_state.update(status_class=UNKNOWN[0], health_label=UNKNOWN[1],
                       recommendation=UNKNOWN[2], data_valid=False,
                       operating_mode=None, anomaly_score=None, anomaly_detected=None,
                       predictions=None, alerts=ml_engine.alerts.active_list(),
                       timestamp=datetime.now(timezone.utc).isoformat())
    enforce_safety(scada_state)
    return response_payload(scada_state)


async def broadcast():
    snapshot = json.dumps(scada_state, allow_nan=False)
    for ws in list(connected_websockets):
        try:
            await ws.send_text(snapshot)
        except Exception:
            if ws in connected_websockets:
                connected_websockets.remove(ws)


async def invalid_telemetry():
    result = mark_unknown()
    await broadcast()
    return result


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Bridge request failed", exc_info=(type(exc), exc, exc.__traceback__))
    result = await invalid_telemetry()
    # Preserve LabVIEW's historical HTTP-200 JSON parsing on telemetry only.
    return JSONResponse(result, status_code=200 if request.url.path == "/api/telemetry" else 500)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    if request.url.path == "/api/telemetry":
        return JSONResponse(await invalid_telemetry())
    # A rejected control is not a new sensor observation; leave state untouched.
    return JSONResponse({"status_class": 2, "health_label": "UNKNOWN",
                         "recommendation": "Invalid command; no changes applied.",
                         "data_valid": False}, status_code=422)


@app.get("/")
def root():
    return {"status": "online", "service": "SCADA LabVIEW Telemetry Bridge"}


@app.get("/api/telemetry")
def get_telemetry():
    return dict(scada_state)


@app.get("/api/predictions")
def get_predictions():
    return {"predictions": scada_state["predictions"], "alerts": ml_engine.alerts.active_list(),
            "models": ml_engine.model_status(), "timestamp": scada_state["timestamp"]}


@app.get("/api/alerts")
def get_alerts(limit: int = 50):
    return {"active": ml_engine.alerts.active_list(),
            "events": ml_engine.alerts.recent(max(1, min(limit, 200)))}


def run_ml(state):
    """Advisory models on the plant as reported, before interlocks rewrite actuators."""
    predictions, _ = ml_engine.process(state)
    anomaly = predictions["anomaly"]
    state.update(operating_mode=predictions["operating_mode"], anomaly_score=anomaly["score"],
                 anomaly_detected=anomaly["detected"], predictions=predictions,
                 alerts=ml_engine.alerts.active_list())
    state["recommendation"] += ml_engine.advisory_text()


def log_history(state):
    if telemetry_logger is None:
        return
    predictions = state["predictions"] or {}
    fault = predictions.get("fault") or {}
    gas = predictions.get("gas") or {}
    row = {**state, "iforest_score": (predictions.get("anomaly") or {}).get("iforest_score"),
           "fault_class": fault.get("label"), "fault_confidence": fault.get("confidence"),
           "pump_health": (predictions.get("pump_health") or {}).get("health"),
           "gas_ppm_calibrated": gas.get("ppm_calibrated"),
           "active_alerts": ";".join(a["kind"] for a in state["alerts"])}
    try:
        telemetry_logger.log(row)
    except OSError:
        logger.exception("Telemetry history write failed")


async def ingest_telemetry(parsed):
    global fan_required
    try:
        values = normalize_payload(parsed)
    except (ValueError, TypeError, OverflowError):
        return await invalid_telemetry()
    state = dict(scada_state)
    state.update(values)
    status, label, rec = evaluate_process_health(*(values[key] for key in SENSOR_RANGES))
    state.update(status_class=status, health_label=label, recommendation=rec, data_valid=True)
    state["timestamp"] = datetime.now(timezone.utc).isoformat()
    run_ml(state)
    log_history(state)
    gas = values["gas_ppm"]
    if gas >= 80:
        fan_required = True
    elif gas < 45:
        fan_required = False
        state["fan_active"] = False
    enforce_safety(state)
    state["timestamp"] = datetime.now(timezone.utc).isoformat()
    scada_state.update(state)
    result = response_payload(state)
    await broadcast()
    return result


@app.post("/api/telemetry")
async def post_telemetry(request: Request):
    try:
        parsed = json.loads((await request.body()).decode("utf-8"))
    except (ValueError, UnicodeError):
        return JSONResponse(await invalid_telemetry())
    return JSONResponse(await ingest_telemetry(parsed))


@app.post("/api/control")
async def post_control(cmd: ControlCommand):
    requested = cmd.model_dump(exclude_unset=True)
    if not requested or any(value is None for value in requested.values()):
        return JSONResponse({"status_class": 2, "health_label": "UNKNOWN",
                             "recommendation": "Supply at least one boolean actuator command.",
                             "data_valid": False}, status_code=422)
    scada_state.update(requested)
    enforce_safety(scada_state)
    scada_state["timestamp"] = datetime.now(timezone.utc).isoformat()
    snapshot = dict(scada_state)
    overridden = [key for key, value in requested.items() if snapshot[key] != value]
    await broadcast()
    return {"status": "interlocked" if overridden else "updated",
            "overridden": overridden, "controls": snapshot}


@app.websocket("/ws/telemetry")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_websockets.append(websocket)
    try:
        await websocket.send_text(json.dumps(scada_state, allow_nan=False))
        while True:
            data = await websocket.receive_text()
            try:
                parsed = json.loads(data)
            except ValueError:
                await invalid_telemetry()
                continue
            await ingest_telemetry(parsed)
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("WebSocket telemetry failed")
        await invalid_telemetry()
    finally:
        if websocket in connected_websockets:
            connected_websockets.remove(websocket)


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
