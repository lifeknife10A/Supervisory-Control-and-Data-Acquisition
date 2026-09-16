"""
SCADA Telemetry & LabVIEW FastAPI Bridge Server
Connects LabVIEW VI, ESP32 Modbus Edge Node, and React 3D Digital Twin Frontend
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import asyncio
import json
import uvicorn

app = FastAPI(
    title="SCADA Industrial Process Telemetry & LabVIEW Bridge",
    version="2.0.0",
    description="Real-time HTTP REST & WebSocket Bridge connecting LabVIEW and React Web HMI",
)

# Enable CORS for React Frontend (localhost:5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TelemetryPayload(BaseModel):
    tank_level: float = 54.2
    temperature: float = 29.4
    gas_ppm: float = 22.0
    current_draw: float = 1.65
    pump_active: Optional[bool] = True
    valve_open: Optional[bool] = False
    fan_active: Optional[bool] = False

class ControlCommand(BaseModel):
    pump_active: Optional[bool] = None
    valve_open: Optional[bool] = None
    fan_active: Optional[bool] = None

# In-memory SCADA Process State
scada_state = {
    "tank_level": 54.2,
    "temperature": 29.4,
    "gas_ppm": 22.0,
    "current_draw": 1.65,
    "pump_active": True,
    "valve_open": False,
    "fan_active": False,
    "status_class": 0,
    "health_label": "HEALTHY",
    "recommendation": "Nominal industrial process parameters. Normal operation.",
    "timestamp": datetime.now(timezone.utc).isoformat(),
}

connected_websockets: List[WebSocket] = []

def evaluate_process_health(tank: float, temp: float, gas: float, current: float) -> tuple[int, str, str]:
    if tank >= 88.0 or gas >= 250.0 or temp >= 70.0 or current >= 3.8:
        reasons = []
        if tank >= 88.0: reasons.append(f"Tank Overflow Hazard ({tank:.1f}%)")
        if gas >= 250.0: reasons.append(f"Toxic Gas Spike ({gas:.0f} PPM)")
        if temp >= 70.0: reasons.append(f"Thermal Runaway ({temp:.1f} °C)")
        if current >= 3.8: reasons.append(f"Motor Overload ({current:.2f} A)")
        return 2, "CRITICAL TRIP (FAULT)", f"EMERGENCY SHUTDOWN: {', '.join(reasons)}. Inflow pump interlocked OFF."

    if tank >= 78.0 or tank <= 25.0 or gas >= 80.0 or temp >= 50.0 or current >= 2.8:
        reasons = []
        if tank >= 78.0: reasons.append("Tank High Warning")
        if tank <= 25.0: reasons.append("Tank Low Warning")
        if gas >= 80.0: reasons.append("Gas Concentration Elevated")
        if temp >= 50.0: reasons.append("Elevated Temperature")
        if current >= 2.8: reasons.append("Elevated Motor Current")
        return 1, "WARNING", f"Caution: {', '.join(reasons)}. Safety fan activated."

    return 0, "HEALTHY", "Nominal process operating conditions. All loops green."

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "SCADA LabVIEW / React Telemetry Bridge",
        "endpoints": {
            "get_telemetry": "/api/telemetry (GET)",
            "post_telemetry": "/api/telemetry (POST)",
            "post_control": "/api/control (POST)",
            "ws_telemetry": "/ws/telemetry (WebSocket)",
        },
    }

@app.get("/api/telemetry")
def get_telemetry():
    """Returns latest telemetry for LabVIEW or React UI"""
    return scada_state

@app.post("/api/telemetry")
async def post_telemetry(payload: TelemetryPayload):
    """
    Receives telemetry updates from LabVIEW VI or ESP32 Node,
    evaluates safety diagnostics, and broadcasts to active WebSockets.
    """
    status_class, label, rec = evaluate_process_health(
        payload.tank_level, payload.temperature, payload.gas_ppm, payload.current_draw
    )
    
    pump = payload.pump_active if payload.pump_active is not None else scada_state["pump_active"]
    valve = payload.valve_open if payload.valve_open is not None else scada_state["valve_open"]
    fan = payload.fan_active if payload.fan_active is not None else scada_state["fan_active"]

    if status_class == 2:
        pump = False
        if payload.tank_level >= 88.0:
            valve = True
    elif status_class == 1 and payload.gas_ppm >= 80.0:
        fan = True

    scada_state.update({
        "tank_level": round(payload.tank_level, 2),
        "temperature": round(payload.temperature, 2),
        "gas_ppm": round(payload.gas_ppm, 1),
        "current_draw": round(payload.current_draw, 2),
        "pump_active": pump,
        "valve_open": valve,
        "fan_active": fan,
        "status_class": status_class,
        "health_label": label,
        "recommendation": rec,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    # Broadcast to WebSocket clients
    for ws in list(connected_websockets):
        try:
            await ws.send_text(json.dumps(scada_state))
        except Exception:
            connected_websockets.remove(ws)

    return {
        "status": "success",
        "health": {
            "status_class": status_class,
            "label": label,
            "recommendation": rec,
        },
        "actuator_commands": {
            "pump_active": scada_state["pump_active"],
            "valve_open": scada_state["valve_open"],
            "fan_active": scada_state["fan_active"],
        },
    }

@app.post("/api/control")
async def post_control(cmd: ControlCommand):
    """Allows React Web UI or LabVIEW operators to toggle actuators"""
    if cmd.pump_active is not None:
        scada_state["pump_active"] = cmd.pump_active
    if cmd.valve_open is not None:
        scada_state["valve_open"] = cmd.valve_open
    if cmd.fan_active is not None:
        scada_state["fan_active"] = cmd.fan_active
    scada_state["timestamp"] = datetime.now(timezone.utc).isoformat()

    for ws in list(connected_websockets):
        try:
            await ws.send_text(json.dumps(scada_state))
        except Exception:
            connected_websockets.remove(ws)

    return {"status": "updated", "controls": scada_state}

@app.websocket("/ws/telemetry")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_websockets.append(websocket)
    try:
        await websocket.send_text(json.dumps(scada_state))
        while True:
            data = await websocket.receive_text()
            try:
                parsed = json.loads(data)
                if "tank_level" in parsed:
                    # Update state
                    await post_telemetry(TelemetryPayload(**parsed))
            except Exception:
                pass
    except WebSocketDisconnect:
        connected_websockets.remove(websocket)

if __name__ == "__main__":
    print("[SCADA BRIDGE] Starting FastAPI Bridge Server on http://localhost:8000...")
    uvicorn.run(app, host="0.0.0.0", port=8000)
