# Advanced Industry 4.0 Distributed SCADA System
## Complete 100% Software Digital Twin & Wokwi Architecture

This project is a complete, distributed SCADA architecture with **zero physical hardware required**. It simulates the physical plant using **Wokwi ESP32 edge nodes**, connects over industrial **Modbus TCP/IP**, performs Machine Learning **Anomaly Detection & Diagnostics** in Python, bridges with **LabVIEW**, and renders live telemetry on a **React Web HMI**.

---

## 🏛️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    WOKWI SIMULATOR (VS Code)                    │
│  - ESP32 DevKit V1                                              │
│  - Potentiometer 1 (Water Tank Level: 0–100%)                   │
│  - Potentiometer 2 (Reactor Temperature: 0–100 °C)              │
│  - Potentiometer 3 (Hazardous Gas Level: 0–1000 PPM)            │
│  - Potentiometer 4 (Pump Motor Current: 0–5.00 A)               │
│  - 2x Relays / LEDs (Pump Actuator & Safety Valve)              │
│  - 16x2 I2C LCD Display (Local Operator Screen)                 │
└────────────────────────────────┬────────────────────────────────┘
                                 │ Modbus TCP / IP (Port 502)
                                 ▼ (via Wokwi Bridge)
┌─────────────────────────────────────────────────────────────────┐
│                    SCADA & INTELLIGENCE LAYER                   │
│                                                                 │
│   ┌─────────────────────────┐       ┌────────────────────────┐  │
│   │      LabVIEW SCADA      │       │     PYTHON BACKEND     │  │
│   │  - Modbus TCP Master    │ JSON  │  - FastAPI Web Server  │  │
│   │  - Local PID & Alarms   │──────>│  - ML Anomaly Engine   │  │
│   │  - HTTP Bridge Client   │       │  - Direct Modbus Poller│  │
│   └─────────────────────────┘       └───────────┬────────────┘  │
└─────────────────────────────────────────────────┼───────────────┘
                                                  │ WebSockets / REST
                                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                     REACT WEB HMI DASHBOARD                     │
│  - Dark-mode Glassmorphic Industrial UI (Tailwind CSS)          │
│  - Real-Time Live Telemetry Gauges & Sliding Charts (Recharts)  │
│  - AI Anomaly Badge (Healthy / Warning / Critical Fault)        │
│  - Interactive Actuator Overrides & Fault Injection Panel       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start Guide (Running the Entire System)

### Step 1: Start the Python ML & FastAPI Backend
Open a terminal in `Mini Project` and run:
```bash
./start_backend.sh
```
* Or manually:
```bash
cd backend
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
./venv/bin/python train_models.py            # ~5 min; trains the sim + rig profiles on sample data
./venv/bin/python -m uvicorn server:app --reload --port 8000
# Real hardware: SCADA_PLANT_PROFILE=rig ./venv/bin/python -m uvicorn server:app --port 8000
```
Backend will be live at `http://localhost:8000` (API Docs at `http://localhost:8000/docs`).
Without trained models the bridge still runs; predictions that need a model show as unavailable.

### Step 2: Start the React Web HMI
In a second terminal, run:
```bash
./start_frontend.sh
```
* Or manually:
```bash
cd frontend
pnpm install
pnpm dev
```
Open your browser at **`http://localhost:5173`**.

---

### Step 3 (Optional): Launch Wokwi Simulation in VS Code
1. Open the project in VS Code with the **Wokwi Simulator** extension installed.
2. Open `Mini Project/wokwi_edge_node/diagram.json`.
3. Press `F1` and select **Wokwi: Start Simulator**.
4. Adjust the potentiometers to see the LCD and live Modbus registers update!
*(Note: If Wokwi is not running, the backend automatically switches to its built-in digital twin physics simulator so everything continues running seamlessly!)*

---

## 📊 Modbus TCP Register Specification

| Address | Type | Name | Engineering Range | Scaling Factor |
| :--- | :--- | :--- | :--- | :--- |
| **00001 (Coil 0)** | Discrete Coil (FC01/05) | `PUMP_RELAY` | 0 (OFF) or 1 (ON) | Boolean |
| **00002 (Coil 1)** | Discrete Coil (FC01/05) | `VALVE_RELAY` | 0 (Closed) or 1 (Open) | Boolean |
| **00003 (Coil 2)** | Discrete Coil (FC01/05) | `FAN_RELAY` | 0 (OFF) or 1 (ON) | Boolean |
| **40001 (Reg 0)** | Holding Register (FC03/04) | `TANK_LEVEL` | 0 – 1000 (0.0% to 100.0%) | $\div 10$ |
| **40002 (Reg 1)** | Holding Register (FC03/04) | `PROCESS_TEMP` | −550 – 1250 (−55.0°C to 125.0°C), **I16** | $\div 10$ |
| **40003 (Reg 2)** | Holding Register (FC03/04) | `GAS_PPM` | 0 – 1000 PPM (MQ-2 LPG curve) | $1:1$ |
| **40004 (Reg 3)** | Holding Register (FC03/04) | `MOTOR_CURRENT`| 0 – 500 (0.00A to 5.00A) | $\div 100$ |
| **40005 (Reg 4)** | Holding Register (FC03/04) | `AMBIENT_TEMP` | BME280 °C, **I16** | $\div 10$ |
| **40006 (Reg 5)** | Holding Register (FC03/04) | `HUMIDITY` | BME280 0 – 1000 (0.0% to 100.0% RH) | $\div 10$ |
| **40007 (Reg 6)** | Holding Register (FC03/04) | `PRESSURE` | BME280 hPa | $\div 10$ |
| **40008 (Reg 7)** | Holding Register (FC03/04) | `SUPPLY_VOLTAGE` | 0 – 2500 (0.00V to 25.00V) | $\div 100$ |
| **40009 (Reg 8)** | Holding Register (FC03/04) | `GAS_SENSOR_MV` | MQ-2 AO at the sensor, mV | $1:1$ |

Any register reading `32767` (`0x7FFF`) means its sensor is faulty, missing or (MQ-2) warming up.

---

## 🛡️ Rule-Based Safety States (deterministic, `backend/process_policy.py`)

* **Class 0: `HEALTHY` (Green)** — Normal steady-state operation within standard envelopes.
* **Class 1: `WARNING` (Amber)** — Tank ≥78% or ≤25%, gas ≥80 PPM, temperature ≥50°C, or current ≥2.8A.
* **Class 2: `CRITICAL TRIP` (Red)** — Tank ≥88%, gas ≥250 PPM, temperature ≥70°C, or current ≥3.8A. Pump interlocked off.

These rules alone drive the interlocks. The ML layer below is **advisory**: it adds alerts and
diagnosis but can never switch an actuator.

---

## 🤖 Predictive Analytics & ML (advisory, `backend/ml_engine.py`)

| Model | Algorithm | Input | Output |
| :--- | :--- | :--- | :--- |
| Anomaly detection | Per-mode robust covariance envelope **+ Isolation Forest** | Pump current, tank/temperature rates (envelope); all 8 signals (forest) | Scores; anomaly flag if either fires |
| Fault classification | Random Forest | 24-sample window statistics | One of 9 classes: normal, gas leak, overheating, dry run, line blockage, motor overload, tank leak, stuck relay, valve stuck |
| Pump health | Gradient Boosting regressor | Current mean/ripple, fill rate, fill per amp, supply voltage while pumping | Health index 0–100 (GOOD / DEGRADING / SERVICE SOON) |
| MQ-2 calibration | Gradient Boosting regressor (datasheet formula fallback) | Raw MQ-2 mV, BME280 temperature & humidity | Temperature/humidity-compensated PPM |
| Forecast | Linear trend over ~60 samples | Tank, temperature, gas | Value in 60 s, time to warning/trip limit |

**Alerts.** Every detection (anomaly, fault class ≥60% confidence, pump health <40%, forecast trip
<120 s, rule warnings/trips, invalid telemetry) becomes an alert after 4 consecutive samples
(trips and invalid data: immediately) and clears after 8 clean samples. Alerts appear as pop-ups
in the web HMI and in the **Predict** panel, are appended to the recommendation text LabVIEW
receives, and every raise/clear is written to `backend/data/events.csv`. Per-sample predictions are
logged to `backend/data/telemetry_log.csv`. APIs: `GET /api/predictions`, `GET /api/alerts`.

**Training data.** No public dataset matches this rig, so models are trained on a datasheet-grounded
plant simulator (`backend/synthetic_plant.py`): ACS712-05B noise, DS18B20 resolution, HC-SR04
accuracy, the MQ-2 LPG curve `ppm = 574.25·(Rs/R0)^−2.222` (MQUnifiedsensor fit of the Hanwei
datasheet) and an approximate reading of the datasheet's temperature/humidity figure. Two plant
profiles exist: `sim` (3D workbench and feeder sim, ~1.6 A pump) and `rig` (BOM mini pump,
~0.1–0.5 A). `train_models.py` prints and saves an evaluation report per profile
(`backend/models/<profile>/report.json`).

**Moving to the real rig.** Run the bridge with `SCADA_PLANT_PROFILE=rig`, log a few normal
fill/drain cycles, then retrain so the models learn *your* tank and pump:
`python train_models.py --profile rig --csv data/telemetry_log.csv`. For gas calibration against a
reference meter, add `--gas-csv` with columns `gas_sensor_mv, ambient_temp, humidity, reference_ppm`.

**Feeder sim faults** for demoing every model without hardware:
`python labview_feeder_sim.py --fault {gas,temp,tank,dry_run,blockage,overload,leak,stuck_relay,valve_stuck} [--wear 0.8]`.

---

## 🧪 Interactive Fault Injection Bench

Inside the React Web HMI (`http://localhost:5173`), you can click:
- **`Gas Leak`**: Simulates a sudden toxic gas spike to test emergency exhaust triggers.
- **`Overheating`**: Simulates thermal runaway to test secondary coolant interlocks.
- **`Cavitation`**: Simulates pump impeller blockage / overcurrent drag.
- **`Overflow`**: Simulates water inlet stuck open.
- **`Reset Normal`**: Returns process variables to healthy baseline.
