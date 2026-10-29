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
1. Use **`Read Holding Registers.vi`** (Function Code 03) starting at address `0` for `9` registers:
   - `Register 0`: Water Tank Level ($\div 10$ to get percentage $0.0\% - 100.0\%$) → JSON `tank_level`
   - `Register 1`: Process Temperature (**I16**, $\div 10$ to get $^\circ\text{C}$) → `temperature`
   - `Register 2`: Gas PPM ($1:1$ scale) → `gas_ppm`
   - `Register 3`: Current Draw ($\div 100$ to get Amperes) → `current_draw`
   - `Register 4`: BME280 Ambient Temperature (**I16**, $\div 10$ → $^\circ\text{C}$) → `ambient_temp` *(optional)*
   - `Register 5`: BME280 Humidity ($\div 10$ → %RH) → `humidity` *(optional)*
   - `Register 6`: BME280 Pressure ($\div 10$ → hPa) → `pressure_hpa` *(optional)*
   - `Register 7`: Supply Voltage ($\div 100$ → V) → `supply_voltage` *(optional)*
   - `Register 8`: MQ-2 sensor output (mV, $1:1$) → `gas_sensor_mv` *(optional, for gas calibration)*
   - A register reading `32767` (`0x7FFF`) means that sensor is faulty, missing or warming up. Forward the scaled value unchanged: the bridge rejects it (core sensors → `UNKNOWN`, pump inhibited) or stores it as absent (optional sensors).
2. Use **`Read Coils.vi`** (Function Code 01) starting at address `0` for `3` coils:
   - `Coil 0`: Pump Relay State (Boolean)
   - `Coil 1`: Valve Relay State (Boolean)
   - `Coil 2`: Exhaust Fan State (Boolean)

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

---

## 4. Wi-Fi Gateway Loop (ESP32 `scada_master_firmware`)

The Wi-Fi firmware serves HTTP JSON instead of Modbus. Each loop iteration makes three calls:

1. **GET** `<ESP32>/api/telemetry` → response string (`{"level_cm":..,"water_temp_c":..,...}`).
2. **POST** that string **unchanged** to `http://127.0.0.1:8000/api/telemetry`. No Unflatten/Flatten
   needed: the bridge detects the ESP32 format and converts it (distance → tank %, MQ-2 volts → ppm).
3. Unflatten the reply with a cluster of `status_class` (I32), `health_label` (string),
   `recommendation` (string), `data_valid` (boolean), `control_query` (string), then
   **GET** `<ESP32>/api/control?` + `control_query` (e.g. `pump=0&valve=1&fan=1`) to apply the
   interlocked commands.

`<ESP32>` is `http://192.168.4.1` (the firmware's Wi-Fi access point). Set the tank geometry before
starting the bridge: `SCADA_TANK_EMPTY_CM` (sensor distance when empty, default 30) and
`SCADA_TANK_FULL_CM` (distance when full, default 5).
