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
| `D2` | `LED_GREEN_STATUS` | 220Ω → Green LED anode (cathode → GND) |
| `D12` | `LED_RED_ALARM` | 220Ω → Red LED anode (cathode → GND) |

Relay `COM`/`NO`/`NC` contacts aren't wired to a modeled load — they carry the
physical pump/valve/fan circuit on real hardware, which is outside what Wokwi (or
this repo) simulates electrically.

Full pin roles and voltage levels: [`pinMapping.ts`](../frontend/src/constants/pinMapping.ts).

## Modbus TCP Map (port 502, slave ID 1)

| Register/Coil | Address | Scale | Description |
| :--- | :--- | :--- | :--- |
| Holding Register | 40001 | ÷10 → % | Tank level |
| Holding Register | 40002 | ÷10 → °C | Reactor temperature |
| Holding Register | 40003 | ×1 → PPM | Gas concentration |
| Holding Register | 40004 | ÷100 → A | Motor current draw |
| Coil | 00001 | — | Feed pump relay |
| Coil | 00002 | — | Drain valve relay |
| Coil | 00003 | — | Exhaust fan relay |

## Safety interlocks (firmware-enforced, matches the 3D sim's `mcuSimulationEngine.ts`)

- Tank level ≥ 88% (overflow), gas ≥ 250 PPM, temperature ≥ 70°C, or current ≥ 3.8A → **master trip**: pump forced off, valve opened on overflow, red LED strobes.
- Tank level ≤ 25% (and temp sensor healthy) → auto-refill: pump on, valve closed.
- Gas > 80 PPM → exhaust fan on; clears below 45 PPM.

## Build & run

```bash
# 1. Install PlatformIO (https://platformio.org/install/cli), then from this folder:
pio run

# 2. Open this folder in VS Code with the Wokwi Simulator extension, then
#    open diagram.json and press F1 -> "Wokwi: Start Simulator".
#    (wokwi.toml already points at the PlatformIO build output.)
```

To run against real hardware instead of Wokwi: flash `src/main.cpp` via PlatformIO
(`pio run -t upload`), wire per the table above, and set `ssid`/`password` in
`main.cpp` to your network. Any Modbus TCP master (LabVIEW, the Python backend
described in [`../SCADA_Project_Guide.md`](../SCADA_Project_Guide.md), or
`mbpoll`) can then poll it on port 502.
