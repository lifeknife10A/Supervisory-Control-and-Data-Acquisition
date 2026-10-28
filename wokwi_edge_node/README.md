# SCADA ESP32 Edge Node — Circuit & Firmware

A real, buildable Wokwi circuit + ESP32 firmware for the process-control node this
project's 3D workbench and dashboard simulate. Pin numbers, Modbus register/coil
addresses and safety thresholds here are the **same single source of truth** used
by [`frontend/src/constants/pinMapping.ts`](../frontend/src/constants/pinMapping.ts)
and [`frontend/src/store/mcuSimulationEngine.ts`](../frontend/src/store/mcuSimulationEngine.ts)
— change one, change all three.

## Files

| File | Purpose |
| :--- | :--- |
| `diagram.json` | Wokwi circuit definition (parts + wiring) |
| `wokwi.toml` | Tells the Wokwi simulator where to find the compiled firmware |
| `platformio.ini` | PlatformIO build config + library dependencies |
| `src/main.cpp` | ESP32 firmware — Modbus TCP server, sensor reads, safety interlocks |

## Circuit

ESP32 DevKit V1, powered over USB. 5V-rail modules (HC-SR04, MQ-2, LCD, relays) are
fed from `VIN` (which carries 5V when the board is USB-powered); 3.3V-only parts
(DS18B20, the current-sense potentiometer stand-in) are fed from `3V3`.

| ESP32 Pin | Net | Connects to |
| :--- | :--- | :--- |
| `D25` | `HC_SR04_TRIG` | HC-SR04 `TRIG` |
| `D34` | `HC_SR04_ECHO` | HC-SR04 `ECHO` *(input-only ADC pin; on real 5V HC-SR04 hardware add a resistor divider — the Wokwi sim tolerates 5V logic directly)* |
| `D4` | `DS18B20_DATA` | DS18B20 `DQ`, plus 4.7kΩ pull-up to `3V3` |
| `D32` | `MQ2_AO` | MQ-2 gas sensor `AO` |
| `D33` | `ACS712_OUT` | Potentiometer `SIG` — **stand-in for the ACS712 current sensor**, which Wokwi's built-in part library doesn't include. Swap the `pot_current` part for a real ACS712 breakout on physical hardware. |
| `D21` / `D22` | `I2C_SDA` / `I2C_SCL` | LCD1602 (I2C backpack) `SDA` / `SCL` |
| `D26` | `RELAY_PUMP_IN` | Feed pump relay module `IN` |
| `D27` | `VALVE_DRIVER_IN` | Drain valve relay module `IN` |
| `D14` | `FAN_DRIVER_IN` | Exhaust fan relay module `IN` |
| `D35` | `SUPPLY_SENSE` | 0–25V voltage sensor module `S` *(physical rig only; not in the Wokwi diagram)* |
| `D21` / `D22` | `I2C_SDA` / `I2C_SCL` | Also the BME280 (GYBM) at 0x76/0x77 *(physical rig only)* |
| `D23` | `LED_GREEN_STATUS` | 220Ω → Green LED anode (cathode → GND) |
| `D13` | `LED_RED_ALARM` | 220Ω → Red LED anode (cathode → GND) |

GPIO 2, 12 and 15 are boot-strapping pins and stay unconnected (see `TRACKER.md`).

Relay `COM`/`NO`/`NC` contacts aren't wired to a modeled load — they carry the
physical pump/valve/fan circuit on real hardware, which is outside what Wokwi (or
this repo) simulates electrically.

Full pin roles and voltage levels: [`pinMapping.ts`](../frontend/src/constants/pinMapping.ts).

## Modbus TCP Map (port 502, slave ID 1)

| Register/Coil | Address | Scale | Description |
| :--- | :--- | :--- | :--- |
| Holding Register | 40001 | ÷10 → % | Tank level |
| Holding Register | 40002 | I16 ÷10 → °C | Process temperature (DS18B20) |
| Holding Register | 40003 | ×1 → PPM | Gas concentration (MQ-2 LPG curve) |
| Holding Register | 40004 | ÷100 → A | Motor current draw (ACS712) |
| Holding Register | 40005 | I16 ÷10 → °C | Ambient temperature (BME280) |
| Holding Register | 40006 | ÷10 → %RH | Ambient humidity (BME280) |
| Holding Register | 40007 | ÷10 → hPa | Ambient pressure (BME280) |
| Holding Register | 40008 | ÷100 → V | Supply voltage (0–25V module) |
| Holding Register | 40009 | ×1 → mV | MQ-2 output at the sensor, for gas calibration |
| Coil | 00001 | — | Feed pump relay |
| Coil | 00002 | — | Drain valve relay |
| Coil | 00003 | — | Exhaust fan relay |

A register holding `32767` (`0x7FFF`) means its sensor is faulty, missing or warming up.
Every register starts at that value until the first good reading.

## Safety interlocks (firmware-enforced, matches the 3D sim's `mcuSimulationEngine.ts`)

- Tank level ≥ 88% (overflow), gas ≥ 250 PPM, temperature ≥ 70°C, or current ≥ 3.8A → **master trip**: pump forced off, valve opened on overflow, red LED strobes.
- Any core sensor faulty (ultrasonic echo timeout, DS18B20 disconnected, ACS712 output below 1.5 V, MQ-2 warming up for 2 min after boot) → **fail-safe**: pump forced off, fan on while gas is unknown, red LED solid. The pump never runs on a reading it cannot trust.
- Tank level ≤ 25% (all sensors healthy) → auto-refill: pump on, valve closed.
- Gas > 80 PPM → exhaust fan on; clears below 45 PPM.

## Calibration (physical rig)

Constants at the top of `src/main.cpp`:

- **ACS712**: zero offset is measured at boot with the pump relay open; sensitivity is 185 mV/A (05B). Its output reaches ~3.4 V at 5 A, above the ESP32's 3.3 V ADC limit; add a divider on `OUT` and set `ACS712_DIVIDER_RATIO` if you expect currents above ~4 A.
- **MQ-2**: check the module's load resistor (`102` = 1 kΩ, `472` = 4.7 kΩ) and set `MQ2_RL_KOHM`. After warm-up in clean air, copy the `[MQ2] R0 estimate` value from the serial monitor into `MQ2_R0_KOHM`. Until then PPM readings are uncalibrated.
- **HC-SR04**: set `TANK_DEPTH_CM` to the distance from the sensor face to the empty-tank bottom.
- **BME280**: detected automatically at 0x76 or 0x77. A BMP280 (same-looking board, no humidity) is reported on serial and its registers stay at the fault value.

## Build & run

```bash
# 1. Install PlatformIO (https://platformio.org/install/cli), then from this folder:
pio run -e wokwi

# 2. Open this folder in VS Code with the Wokwi Simulator extension, then
#    open diagram.json and press F1 -> "Wokwi: Start Simulator".
#    (wokwi.toml points at the wokwi build output.)
```

The `wokwi` build reads the current potentiometer linearly as 0–5 A and skips the
MQ-2 warm-up; the default `esp32dev` build uses the real ACS712 and MQ-2 conversions.

To run against real hardware instead of Wokwi: copy `src/secrets.example.h` to
`src/secrets.h` (gitignored) with your Wi-Fi network, then flash with
`pio run -e esp32dev -t upload` and wire per the table above. Any Modbus TCP master (LabVIEW, the Python backend
described in [`../SCADA_Project_Guide.md`](../SCADA_Project_Guide.md), or
`mbpoll`) can then poll it on port 502.
