# LabVIEW Integration & HTTP Bridge Guide

This guide explains how LabVIEW can connect to the **Python ML Backend** and **Wokwi Modbus TCP Edge Node**.

---

## 1. Direct Modbus TCP Master Polling in LabVIEW

LabVIEW can poll the simulated ESP32 (Wokwi) or local Modbus server using the **NI Modbus Library** (available via VI Package Manager).

### Modbus Connection Parameters:
* **IP Address:** `127.0.0.1` (or local bridge IP)
* **Port:** `5020` (or `502`)
* **Slave ID (Unit ID):** `1`
* **Polling Rate:** 200ms recommended

### Reading Telemetry in LabVIEW:
1. Use **`Read Holding Registers.vi`** (Function Code 03) starting at address `0` for `4` registers:
   - `Register 0`: Water Tank Level ($\div 10$ to get percentage $0.0\% - 100.0\%$)
   - `Register 1`: Reactor Temperature ($\div 10$ to get $^\circ\text{C}$)
   - `Register 2`: Gas PPM ($1:1$ scale)
   - `Register 3`: Current Draw ($\div 100$ to get Amperes)
2. Use **`Read Coils.vi`** (Function Code 01) starting at address `0` for `2` coils:
   - `Coil 0`: Pump Relay State (Boolean)
   - `Coil 1`: Valve Relay State (Boolean)

---

## 2. LabVIEW to Python HTTP Bridge

If your team wants LabVIEW to act as the primary SCADA poller and forward data to the Python ML engine:

### HTTP POST Endpoint:
* **URL:** `http://localhost:8000/api/telemetry`
* **Method:** `POST`
* **Content-Type:** `application/json`

### JSON Payload:
```json
{
  "tank_level": 55.4,
  "temperature": 32.1,
  "gas_ppm": 22.0,
  "current_draw": 1.65
}
```

### LabVIEW Implementation Steps:
1. Place a **Flatten To JSON** VI to serialize a cluster with the above 4 numeric fields.
2. Pass the JSON string and URL to the **HTTP Client POST.vi** from LabVIEW's built-in `Data Communication -> Protocols -> HTTP Client` palette.
3. The response will contain the Python ML classification (`Class 0: Healthy`, `Class 1: Warning`, `Class 2: Critical Fault`).

---

## 3. Remote Actuator Control from LabVIEW

To write commands back to the virtual plant from LabVIEW:
* Use **`Write Single Coil.vi`** (Function Code 05):
  - Address `0`: `TRUE` to start Pump, `FALSE` to stop Pump.
  - Address `1`: `TRUE` to open Safety Valve, `FALSE` to close Safety Valve.
