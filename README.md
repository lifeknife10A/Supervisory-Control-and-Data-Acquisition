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
./venv/bin/python train_anomaly_model.py   # add --csv data/telemetry_log.csv once you have logged history
./venv/bin/python -m uvicorn server:app --reload --port 8000
```
Backend will be live at `http://localhost:8000` (API Docs at `http://localhost:8000/docs`).

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

## 🤖 Machine Learning Diagnostic States

* **Class 0: `HEALTHY` (Green)** — Normal steady-state operation within standard envelopes.
* **Class 1: `WARNING / DRIFT` (Amber)** — Early precursor detected (motor current drag, thermal elevation, slight gas drift).
* **Class 2: `CRITICAL FAULT` (Red)** — Safety threshold exceeded (gas leak >250 PPM, temperature >70°C, motor lock >3.8A, or tank dry-run/overflow).

---

## 🧪 Interactive Fault Injection Bench

Inside the React Web HMI (`http://localhost:5173`), you can click:
- **`Gas Leak`**: Simulates a sudden toxic gas spike to test emergency exhaust triggers.
- **`Overheating`**: Simulates thermal runaway to test secondary coolant interlocks.
- **`Cavitation`**: Simulates pump impeller blockage / overcurrent drag.
- **`Overflow`**: Simulates water inlet stuck open.
- **`Reset Normal`**: Returns process variables to healthy baseline.
