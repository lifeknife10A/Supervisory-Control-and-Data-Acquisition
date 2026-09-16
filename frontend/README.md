# SCADA Lab 3D – Industrial Process Control & Virtual MCU Simulator

A high-fidelity, interactive 3D digital twin and virtual microcontroller simulator for industrial process control and SCADA education. Built with React 19, Three.js, React Three Fiber, Zustand, and Tailwind CSS.

---

## 🌟 Key Features

### 1. 3D Industrial Breadboard Workbench
- **Interactive Component Catalog**: Drag-and-drop 13 industrial sensors and actuators directly onto an antistatic ESD work mat:
  - ESP32 DevKit V1 Microcontroller
  - Full-Size 830-Point Solderless Breadboard with tie-point netlists
  - HC-SR04 Ultrasonic Distance / Level Sensor
  - DS18B20 Digital Temperature Sensor (with 4.7kΩ pull-up resistor)
  - MQ-2 Hazardous Gas Sensor
  - ACS712 Hall-Effect Motor Current Sensor
  - 5V Relay Module (Optoisolated)
  - 12V High-Torque Feed Pump Motor
  - High-Speed DC Exhaust Cooling Fan (with dynamic 3D blade aerodynamics)
  - 12V Normally-Closed Solenoid Valve
  - 16x2 I2C Character LCD Display (live rendered dot-matrix canvas texture)
  - Status Indicator LEDs (Green RUN, Red ALARM with 220Ω series resistors)
- **Natural Organic Jumper Wiring**: Click pin terminals to dynamically route catenary-curved jumper wires with customizable wire colors and droop/sag.
- **3D Gizmo & Orientation Control**: Rotate components across X (Pitch), Y (Yaw), and Z (Roll) axes with keyboard shortcuts (`R`, `X`, `Z`) or interactive 3D rotation rings (`T`).

### 2. DSU Electrical Netlist Validation Engine
- **Physics-Grounded Connectivity**: Pure visual wires are not enough. A Disjoint Set Union (DSU) graph solver models the breadboard internal tie-point strips (rows a–e, f–j, and power rails +/-) and traces electrical conductivity:
  - **ESP32 Power**: Requires 5V (VIN) and GND rails to be connected.
  - **In-Series Current Measurement**: ACS712 IP+ and IP- pins must be routed in series between Relay NO and Pump VCC.
  - **One-Wire Pull-Up**: DS18B20 DQ pin requires a 4.7kΩ resistor tied to the 5V/3.3V rail.
  - **Trigger / Echo**: HC-SR04 TRIG routed to GPIO 25 and ECHO routed to GPIO 34.
- **Gated Telemetry**: Disconnecting or removing a wire instantly produces open-circuit sensor conditions (0.0% tank level, -127.0°C open DS18B20 fault, 0 PPM gas, 0.00A current) and triggers SCADA safety interlocks.

### 3. In-Browser Virtual MCU Engine (ESP32 Digital Twin)
- **Autonomous Closed-Loop Simulation**: Executes a 550ms loop cycle running PID and threshold-based process control logic.
- **Atomic State Synchronization**: Modbus coils, ESP32 GPIO states, and SCADA telemetry share a single canonical source of truth.
- **Accurate Real-Time Uptime**: Virtual MCU clock advances truthfully at 1:1 real-time speed.
- **Industrial Safety Interlocks**:
  - High Tank Level (>85%) or Critical Alarm automatically trips the feed pump off and energizes the safety valve.
  - Gas Leak (>250 PPM) or High Temperature (>65°C) activates the exhaust cooling fan.

### 4. Modbus TCP & SCADA Telemetry Mapping
All process variables and discrete coils are mapped according to industrial Modbus standards:

| Modbus Holding Register | PDU Wire Offset | Signal Parameter | Engineering Range | Scaling |
| :--- | :--- | :--- | :--- | :--- |
| **40001** | `0x0000` (0) | Tank Level | 0.0% – 100.0% | $\times 10$ |
| **40002** | `0x0001` (1) | Reactor Temperature | 0.0°C – 100.0°C | $\times 10$ |
| **40003** | `0x0002` (2) | Hazardous Gas PPM | 0 – 1000 PPM | $1:1$ |
| **40004** | `0x0003` (3) | Motor Current Draw | 0.00 A – 5.00 A | $\times 100$ |

| Discrete Coil | PDU Wire Offset | Actuator Parameter | States |
| :--- | :--- | :--- | :--- |
| **00001** | `0x0000` (0) | Feed Pump Relay (GPIO 26) | 0: OFF / DE-ENERGIZED, 1: ON / ENERGIZED |
| **00002** | `0x0001` (1) | Safety Drain Valve (GPIO 27)| 0: CLOSED, 1: OPEN |
| **00003** | `0x0002` (2) | Exhaust Cooling Fan (GPIO 14)| 0: STOPPED, 1: RUNNING |

*Global JavaScript Polling API*: Access live telemetry anytime in browser dev tools via `window.getSCADATelemetry()`.

---

## ⌨️ Controls & Shortcuts

| Action | Control / Shortcut |
| :--- | :--- |
| **Orbit 3D View** | `Shift + Left Drag` |
| **Pan Camera** | `Right Click + Drag` |
| **Zoom In / Out** | `Mouse Wheel / Trackpad Scroll` |
| **Marquee Box Selection** | `Left Click + Drag on Table Surface` |
| **Draft Jumper Wire** | Click any component terminal pin |
| **Complete Jumper Wire** | Click destination pin |
| **Cancel Wire Draft** | `Escape` |
| **Rotate Selected (Y-Axis)** | `R` (or `Shift + R` for reverse) |
| **Tilt Selected (X-Axis)** | `X` |
| **Roll Selected (Z-Axis)** | `Z` |
| **Toggle 3D Rotation Rings** | `T` |
| **Delete Component(s)** | `Delete` / `Backspace` |
| **Undo Wire Action** | `Ctrl + Z` (or Toolbar Undo button) |
| **Redo Wire Action** | `Ctrl + Y` (or Toolbar Redo button) |
| **Reset Camera View** | Click `TOP`, `FRONT`, or `ISO` in ViewCube or Toolbar |

---

## 🛠️ Development & Building

Always use `pnpm` as the package manager:

```bash
# Install dependencies
pnpm install

# Start Vite live development server
pnpm dev

# Typecheck and build optimized production bundle
pnpm run build

# Run Oxlint
pnpm run lint
```
