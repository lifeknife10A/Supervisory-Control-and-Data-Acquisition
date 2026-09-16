# LabVIEW SCADA VI Design Blueprint & Wiring Guide
## Architecture: Sensor ➔ LabVIEW ➔ React Frontend with Python Scripting

This document serves as the **complete engineering blueprint** for building the primary LabVIEW Virtual Instrument (`SCADA_Master_Controller.vi`).

---

## 1. System Dataflow Pipeline

```
[ PHYSICAL / SIMULATED SENSORS ]
  • Tank Level Transmitter (0 - 100%)
  • Temperature Sensor (0 - 100 °C)
  • Gas Detector (0 - 1000 PPM)
  • Current Transducer (0 - 5.00 A)
              │
              ▼ (Modbus TCP Port 502 OR Serial / DAQ)
┌────────────────────────────────────────────────────────┐
│               LabVIEW SCADA SUPERVISORY VI             │
│                                                        │
│  [Loop 1: Sensor Acquisition (200ms)]                  │
│    • NI Modbus TCP Master or DAQ Assistant             │
│    • Scaling & Engineering Unit Conversion             │
│                                                        │
│  [Loop 2: Python Scripting Engine (Inline)]            │
│    • Native "Call Python Function.vi"                  │
│    • Script: backend/labview_python_node.py            │
│    • ML Classification: Healthy (0), Warn (1), Trip (2)│
│                                                        │
│  [Loop 3: Web Bridge Client (HTTP POST)]               │
│    • Endpoint: http://localhost:8000/api/telemetry     │
│    • Streams JSON payload to FastAPI WebSockets        │
│    • Receives Operator Remote Actuator Commands        │
└───────────────────────────┬────────────────────────────┘
                            │ WebSockets & REST (JSON)
                            ▼
[ REACT WEB HMI DASHBOARD (http://localhost:5173) ]
  • Live Animated P&ID Plant Graphic
  • AI Health Diagnostics & Confidence Score
  • Real-Time Sliding Telemetry Charts (Recharts)
  • Operator Remote Overrides (Pump / Valve / Auto PID)
```

---

## 2. LabVIEW Block Diagram Implementation (3 Parallel Loops)

### Loop A: Sensor Data Acquisition
* **Palette Path:** `Data Communication ➔ Protocols ➔ Modbus` OR `Measurement I/O ➔ DAQmx`
1. **Initialize Connection:**
   - VI: `Create Modbus TCP Master.vi`
   - IP Address: `127.0.0.1` (or local bridge IP)
   - Port: `5020` (or `502`)
2. **Read Process Registers:**
   - VI: `Read Holding Registers.vi` (Function Code 03)
   - Starting Address: `0`
   - Quantity: `4`
3. **Scale to Engineering Units:**
   - `Register 0`: Water Level = `Value / 10.0` (%)
   - `Register 1`: Temperature = `Value / 10.0` (°C)
   - `Register 2`: Gas PPM = `Value * 1.0` (PPM)
   - `Register 3`: Current Draw = `Value / 100.0` (Amperes)
4. **Bundle into Cluster:**
   - Create a LabVIEW Cluster named `SCADA_Telemetry` containing the 4 numeric values.

---

### Loop B: Direct Python Scripting Integration (LabVIEW Python Node)
* **Palette Path:** `Connectivity ➔ Python`
* LabVIEW includes native support to run Python scripts directly inside its Block Diagram without external servers.

```
+--------------------+      +---------------------------+      +---------------------+
| Open Python Session| ===> | Call Python Function.vi   | ===> | Close Python Session|
| Version: "3.10"    |      | Script: labview_python_node|      +---------------------+
+--------------------+      | Function: "get_tuple_output"|
                            +---------------------------+
```

1. **Open Python Session.vi**:
   - Wire a string constant `"3.10"` (or `"3.11"` / `"3.12"`) to the `Python Version` terminal.
2. **Call Python Function.vi**:
   - **Python Module Path:** Wire the absolute file path to:
     `.../Mini Project/backend/labview_python_node.py`
   - **Function Name:** Wire string `"get_tuple_output"` (or `"diagnose_telemetry"`).
   - **Parameters In:** Pass the 4 sensor floats (`tank_level`, `temperature`, `gas_ppm`, `current_draw`).
   - **Return Type:**
     - For `get_tuple_output`: A cluster of `(Int32 class_id, String label, Dbl confidence, String recommendation)`.
     - For `diagnose_telemetry`: A JSON String.
3. **Display Output:**
   - Wire `class_id` to a numeric color indicator:
     - `0`: Green LED (HEALTHY)
     - `1`: Yellow LED (WARNING)
     - `2`: Red LED (CRITICAL FAULT)
   - Wire `recommendation` to a string indicator on the Front Panel.

---

### Loop C: HTTP Bridge to React Web HMI
* **Palette Path:** `Data Communication ➔ Protocols ➔ HTTP Client`

1. **Format Telemetry as JSON:**
   - Pass the `SCADA_Telemetry` cluster to the **`Flatten To JSON.vi`**.
   - Resulting JSON structure:
     ```json
     {
       "tank_level": 54.2,
       "temperature": 29.8,
       "gas_ppm": 22.0,
       "current_draw": 1.65
     }
     ```
2. **Execute HTTP POST:**
   - Place **`HTTP Client POST.vi`**.
   - URL: `http://localhost:8000/api/telemetry`
   - Buffer In: JSON String
   - Header: `Content-Type: application/json`
3. **Parse Web HMI Remote Commands:**
   - The Python backend returns the latest actuator commands submitted from the React UI:
     ```json
     {
       "status": "success",
       "controls": {
         "pump_active": true,
         "valve_open": false,
         "auto_pid": true,
         "level_setpoint": 55.0
       }
     }
     ```
   - Feed the response into **`Unflatten From JSON.vi`** to extract `pump_active` and `valve_open`.
4. **Write Back to Actuators:**
   - Use **`Write Single Coil.vi`** (Function Code 05):
     - Address `0` (Pump Relay) = `controls.pump_active`
     - Address `1` (Safety Valve) = `controls.valve_open`

---

## 3. Recommended LabVIEW Front Panel Layout

```
=============================================================================
              INDUSTRY 4.0 DISTRIBUTED SCADA - LABVIEW MASTER
=============================================================================

  [ LIVE TELEMETRY ]                          [ MACHINE LEARNING (PYTHON) ]
  Tank Level Gauge     : [ 52.4 % ]            Status Code   : [ 0 - HEALTHY ]
  Reactor Temp Meter   : [ 28.5 C ]            AI Confidence : [ 98.2 % ]
  Gas Concentration    : [ 24 PPM ]            Action Item   : Routine monitoring
  Pump Current Draw    : [ 1.62 A ]            Health LED    : (🟢 GREEN)

  [ LOCAL CONTROL & INTERLOCKS ]              [ WEB BRIDGE STATUS ]
  Pump Actuator Switch : [ (ON) ]              FastAPI Link  : [ ONLINE (5 Hz) ]
  Emergency Dump Valve : [ (OFF) ]             React Clients : [ 1 Connected ]
  Auto Level PID Loop  : [ ENABLED ]           Last Push RTT : [ 12 ms ]
  Target Setpoint (0-100%): ===[ 55.0% ]===

  [ EMERGENCY TRIP ]
  [ ! EMERGENCY SHUTDOWN PUSHBUTTON ! ]
=============================================================================
```

---

## 4. Verification Without LabVIEW Installed

If testing on a macOS computer where LabVIEW is not installed, you can simulate LabVIEW's exact behavior using the bundled test harness:

```bash
# Terminal 1: Run Backend
./start_backend.sh

# Terminal 2: Run Frontend
./start_frontend.sh

# Terminal 3: Run LabVIEW Simulator (emulates LabVIEW polling sensors and pushing to Python)
python3 backend/labview_feeder_sim.py --fault normal
```
You can also inject faults directly from the LabVIEW simulator:
```bash
python3 backend/labview_feeder_sim.py --fault gas
python3 backend/labview_feeder_sim.py --fault temp
python3 backend/labview_feeder_sim.py --fault cavitation
```
