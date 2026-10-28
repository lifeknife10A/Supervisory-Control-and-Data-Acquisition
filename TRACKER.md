# SCADA Physical Hardware & Breadboard Netlist Tracker

> **Project**: Physical ESP32 SCADA Edge Node + LabVIEW Master Dashboard + Python AI Predictive Twin  
> **Hardware Architecture**: Dual Half-Breadboard Bridge Configuration  
> **Last Updated**: 2026-10-28  

---

## 1. Physical Breadboard Topology & Geometry

- **Chassis**: Two 30-row half-size solderless breadboards mounted side-by-side on cardboard.
  - **Board A (Left)**: Houses left ESP32 header on Column `j` (Rows 1–15) and +5V Main Power Rail on Far Left.
  - **Board B (Right)**: Houses right ESP32 header on Column `a` (Rows 1–15) and +3.3V Logic Rail on Far Right.
- **Center Bridge**: The 30-pin ESP32 DevKit V1 directly bridges the physical gap between Board A and Board B.
  - **Orientation**: **Wi-Fi Antenna pointing UP (towards Row 1)**, **Micro-USB port pointing DOWN (towards Row 15)**.
- **Access Channels**:
  - **Board A Left Header Access**: Columns `f, g, h, i` (Rows 1–15) provide 4 open tie-points per left pin.
  - **Board B Right Header Access**: Columns `b, c, d, e` (Rows 1–15) provide 4 open tie-points per right pin.
  - **Passive Conditioning Zone**: Rows 16–30 on both Board A and Board B remain 100% open for voltage dividers, resistors, and indicators.

---

## 2. Power Rail Assignments

| Power Rail | Physical Location | Voltage Domain | Source Pin | Connected Devices |
|:---|:---|:---:|:---|:---|
| **Board A Left Red (+)** | Far Left Rail (+) | **+5.0V DC Main Bus** | ESP32 `VIN` (Board A: Row 15 Col i) | HC-SR04 VCC, MQ-2 VCC, ACS712 VCC, Relay VCC, 16x2 LCD VCC |
| **Board A Left Blue (-)** | Far Left Rail (-) | **0V System Ground** | ESP32 `GND` (Board A: Row 14 Col i) | Common Ground reference |
| **Board B Right Red (+)** | Far Right Rail (+) | **+3.3V DC Logic Bus** | ESP32 `3V3` (Board B: Row 15 Col b) | GYBM (BME280) VCC, DS18B20 VDD, Pull-up resistors |
| **Board B Right Blue (-)** | Far Right Rail (-) | **0V System Ground** | Bridged from Board A Blue Rail | Common Ground reference |

---

## 3. ESP32 30-Pin Master Socket Allocation Matrix

### Left Header — Plugged into Board A, Column `j`, Rows 1 to 15
*(Access any pin via Board A, that same Row, Columns `f, g, h, i` — typically Col `i`)*

| Row # | Pin Silkscreen | Occupied Socket | Primary Access Hole | Electrical Role & Subsystem | Target Destination | Status |
|:---:|:---|:---:|:---:|:---|:---|:---:|
| **1** | `EN` | Board A: 1j | Board A: 1i | Chip Enable / Hardware Reset | Open / Internal pull-up | UNUSED |
| **2** | `VP` (GPIO 36) | Board A: 2j | Board A: 2i | ADC1_CH0 (Input Only) | Free | UNUSED |
| **3** | `VN` (GPIO 39) | Board A: 3j | Board A: 3i | ADC1_CH3 (Input Only) | Free | UNUSED |
| **4** | `D34` (GPIO 34) | Board A: 4j | Board A: 4i | Digital Input (Input Only) | HC-SR04 Echo (via 3.0V divider) | **VERIFIED (Sensor 1)** |
| **5** | `D35` (GPIO 35) | Board A: 5j | Board A: 5i | ADC1_CH7 (Analog Input) | 10123W150075 0-25V Voltage Sensor | **ASSIGNED (Sensor 4)** |
| **6** | `D32` (GPIO 32) | Board A: 6j | Board A: 6i | ADC1_CH4 (Analog Input) | MQ-2 Gas Analog AO (via 2.5V divider) | **VERIFIED (Sensor 2)** |
| **7** | `D33` (GPIO 33) | Board A: 7j | Board A: 7i | ADC1_CH5 (Analog Input) | ACS712 Current OUT | ASSIGNED (Sensor 5) |
| **8** | `D25` (GPIO 25) | Board A: 8j | Board A: 8i | Digital Output | HC-SR04 Ultrasonic Trigger Pulse | **ASSIGNED (Sensor 1)** |
| **9** | `D26` (GPIO 26) | Board A: 9j | Board A: 9i | Digital Output | 4-Ch Relay IN1: Inflow Water Pump | **ACTIVE (Relay Ch 1)** |
| **10** | `D27` (GPIO 27) | Board A: 10j | Board A: 10i | Digital Output | 4-Ch Relay IN2: 12V Solenoid Drain Valve | **ALLOCATED (Relay Ch 2)** |
| **11** | `D14` (GPIO 14) | Board A: 11j | Board A: 11i | Digital Output | 4-Ch Relay IN3: 12V DC Exhaust Fan | **ALLOCATED (Relay Ch 3)** |
| **12** | `D12` (GPIO 12) | Board A: 12j | Board A: 12i | MTDI Boot Strapping Pin | Kept strictly unconnected | **PROTECTED (Free)** |
| **13** | `D13` (GPIO 13) | Board A: 13j | Board A: 13i | Digital Output | Red Alarm Trip Indicator LED (220Ω) | ASSIGNED (Indicator) |
| **14** | `GND` | Board A: 14j | Board A: 14i | Primary DC Ground | Wire 0.2 $\rightarrow$ Board A Left Blue Rail (-) | **CONNECTED (Step 1)** |
| **15** | `VIN` | Board A: 15j | Board A: 15i | +5.0V External Power Input | Wire 0.1 $\rightarrow$ Board A Left Red Rail (+) | **CONNECTED (Step 1)** |

---

### Right Header — Plugged into Board B, Column `a`, Rows 1 to 15
*(Access any pin via Board B, that same Row, Columns `b, c, d, e` — typically Col `b`)*

| Row # | Pin Silkscreen | Occupied Socket | Primary Access Hole | Electrical Role & Subsystem | Target Destination | Status |
|:---:|:---|:---:|:---:|:---|:---|:---:|
| **1** | `D23` (GPIO 23) | Board B: 1a | Board B: 1b | Digital Output | Green Status Indicator LED (220Ω) | ASSIGNED (Indicator) |
| **2** | `D22` (GPIO 22) | Board B: 2a | Board B: 2b | I2C Hardware Clock (`SCL`) | 16x2 LCD HW-61 & GYBM SCL | ASSIGNED (I2C Bus) |
| **3** | `TX0` (GPIO 1) | Board B: 3a | Board B: 3b | UART0 Programming Transmit | Kept free for USB flashing | **PROTECTED (Free)** |
| **4** | `RX0` (GPIO 3) | Board B: 4a | Board B: 4b | UART0 Programming Receive | Kept free for USB flashing | **PROTECTED (Free)** |
| **5** | `D21` (GPIO 21) | Board B: 5a | Board B: 5b | I2C Hardware Data (`SDA`) | 16x2 LCD HW-61 & GYBM SDA | ASSIGNED (I2C Bus) |
| **6** | `D19` (GPIO 19) | Board B: 6a | Board B: 6b | VSPI MISO / Digital GPIO | Free | UNUSED |
| **7** | `D18` (GPIO 18) | Board B: 7a | Board B: 7b | VSPI SCK / Digital GPIO | Free | UNUSED |
| **8** | `D5` (GPIO 5) | Board B: 8a | Board B: 8b | VSPI CS / Strapping Pin | Free | UNUSED |
| **9** | `TX2` (GPIO 17) | Board B: 9a | Board B: 9b | UART2 Transmit / Digital GPIO | Free | UNUSED |
| **10** | `RX2` (GPIO 16) | Board B: 10a | Board B: 10b | UART2 Receive / Digital GPIO | Free | UNUSED |
| **11** | `D4` (GPIO 4) | Board B: 11a | Board B: 11b | Bidirectional 1-Wire Bus | DS18B20 Temp Probe Data (4.7kΩ pull-up) | ASSIGNED (Sensor 4) |
| **12** | `D2` (GPIO 2) | Board B: 12a | Board B: 12b | Boot Strapping / Built-in LED | Kept strictly unconnected | **PROTECTED (Free)** |
| **13** | `D15` (GPIO 15) | Board B: 13a | Board B: 13b | Boot Strapping / HSPI_CS | Kept strictly unconnected | **PROTECTED (Free)** |
| **14** | `GND` | Board B: 14a | Board B: 14b | Secondary DC Ground | Open / Common to Board B Blue Rail | UNUSED |
| **15** | `3V3` | Board B: 15a | Board B: 15b | +3.3V Regulated Output | Wire 0.3 $\rightarrow$ Board B Right Red Rail (+) | **CONNECTED (Step 1)** |

---

## 4. Chronological Physical Wire & Passive Log

| Wire ID | Step / Subsystem | Recommended Color | Actual User Color | Type | Origin (From) | Destination (To) | Verification Status |
|:---:|:---|:---:|:---:|:---:|:---|:---|:---:|
| `W-0.1` | Step 1: 5V Power Feed | **RED** | **YELLOW** | M-M | Board A: Row 15 Col i (`VIN`) | Board A: Left Red Rail (+) | **VERIFIED (Active)** |
| `W-0.2` | Step 1: GND Power Feed | **BLACK** | **BLUE** | M-M | Board A: Row 14 Col i (`GND`) | Board A: Left Blue Rail (-) | **VERIFIED (Active)** |
| `W-0.3` | Step 1: 3.3V Logic Feed | **ORANGE** | **YELLOW** | M-M | Board B: Row 15 Col b (`3V3`) | Board B: Right Red Rail (+) | **VERIFIED (Active)** |
| `W-0.4a` | Step 1: Board B GND Feed | **BLACK** | **BLUE** | M-M | Board B: Row 14 Col b (`GND`) | Board B: Right Blue Rail (-) | **VERIFIED (Active)** |
| `W-0.4b` | Step 1: Common GND Bridge | **BLACK** | **GREY** | M-M | Board A: Left Blue Rail (Row 30) | Board B: Right Blue Rail (Row 30) | **VERIFIED (Active)** |
| `W-1.1` | Sensor 1: HC-SR04 VCC | **RED** | **RED** | F-M | HC-SR04 `VCC` Pin | Board A: Left Red Rail (+5V) | **VERIFIED (Active)** |
| `W-1.2` | Sensor 1: HC-SR04 GND | **BLUE** | **BLACK** | F-M | HC-SR04 `GND` Pin | Board A: Left Blue Rail (GND) | **VERIFIED (Active)** |
| `W-1.3` | Sensor 1: HC-SR04 TRIG | **GREEN** / Any | **GREEN** | F-M | HC-SR04 `TRIG` Pin | Board A: Row 8 Col i (GPIO 25) | **VERIFIED (Active)** |
| `W-1.4` | Sensor 1: HC-SR04 ECHO | **WHITE** / Any | **WHITE** | F-M | HC-SR04 `ECHO` Pin | Board B: Row 16 Col c (Divider In) | **VERIFIED (Active)** |
| `R-1.1` | Sensor 1: 1.0 kΩ Resistor | *Brown-Black-Red* | **1.0 kΩ (Brown-Black-Red)** | Passive | Board B: Row 16 Col d | Board B: Row 17 Col d | **VERIFIED (Active)** |
| `R-1.2` | Sensor 1: 1.5 kΩ Resistor | *Brown-Green-Red* | **1.5 kΩ (Brown-Green-Red)** | Passive | Board B: Row 17 Col e | Board B: Row 18 Col e | **VERIFIED (Active)** |
| `W-1.5` | Sensor 1: Divider Ground | **BLUE** | **BROWN** | M-M | Board B: Row 18 Col d | Board B: Right Blue Rail (GND) | **VERIFIED (Active)** |
| `W-1.6` | Sensor 1: Stepped Echo (3.0V) | **ORANGE** / Any | **PURPLE** | M-M | Board B: Row 17 Col c (3.0V Node) | Board A: Row 4 Col i (GPIO 34) | **VERIFIED (Active)** |
| `W-2.1` | Sensor 2: MQ-2 VCC | **RED** | **RED** | F-M | MQ-2 `VCC` Pin | Board A: Left Red Rail (+5V) | **VERIFIED (Active)** |
| `W-2.2` | Sensor 2: MQ-2 GND | **BLUE** / **BLACK** | **BLACK** | F-M | MQ-2 `GND` Pin | Board A: Left Blue Rail (GND) | **VERIFIED (Active)** |
| `W-2.3` | Sensor 2: MQ-2 AO | **YELLOW** / Any | **GREEN** | F-M | MQ-2 `AO` Pin | Board B: Row 22 Col c (Divider In) | **VERIFIED (Active)** |
| `R-2.1` | Sensor 2: 15 kΩ Resistor | *Brown-Green-Orange* | **15 kΩ (Brown-Green-Orange)** | Passive | Board B: Row 22 Col d | Board B: Row 23 Col d | **VERIFIED (Active)** |
| `R-2.2` | Sensor 2: 15 kΩ Resistor | *Brown-Green-Orange* | **15 kΩ (Brown-Green-Orange)** | Passive | Board B: Row 23 Col e | Board B: Row 24 Col e | **VERIFIED (Active)** |
| `W-2.4` | Sensor 2: Divider Ground | **BLUE** / **BLACK** | **GREY** | M-M | Board B: Row 24 Col d | Board B: Right Blue Rail (GND) | **VERIFIED (Active)** |
| `W-2.5` | Sensor 2: Stepped AO (2.5V) | **ORANGE** / Any | **WHITE** | M-M | Board B: Row 23 Col c (2.5V Node) | Board A: Row 6 Col i (GPIO 32) | **VERIFIED (Active)** |
| `W-3.1` | Sensor 3: GYBM VCC (3.3V) | **RED** / Any | **RED** | F-M | GYBM `VCC` Pin | Board B: Right Red Rail (+3.3V) | **VERIFIED (Active)** |
| `W-3.2` | Sensor 3: GYBM GND | **BLACK** / **BLUE** | **PURPLE** | F-M | GYBM `GND` Pin | Board B: Right Blue Rail (GND) | **VERIFIED (Active)** |
| `W-3.3` | Sensor 3: GYBM SCL | **YELLOW** / Any | **YELLOW** | F-M | GYBM `SCL` Pin | Board B: Row 2 Col b (GPIO 22 / SCL) | **VERIFIED (Active)** |
| `W-3.4` | Sensor 3: GYBM SDA | **GREEN** / Any | **GREEN** | F-M | GYBM `SDA` Pin | Board B: Row 5 Col b (GPIO 21 / SDA) | **VERIFIED (Active)** |
| `W-4.1` | Sensor 4: Voltage Sensor S | **BLUE** / Any | **WHITE** | F-M | 10123W150075 `S` Pin | Board A: Row 5 Col i (GPIO 35 / D35) | **VERIFIED (Active)** |
| `W-4.2` | Sensor 4: Voltage Sensor - | **BLACK** / **BLUE** | **BLACK** | F-M | 10123W150075 `-` Pin | Board A: Left Blue Rail (GND) | **VERIFIED (Active)** |
| `W-5.1` | Sensor 5: DS18B20 VDD (3.3V) | **RED** | Soldered & Ready | Wire/F-M | DS18B20 RED Lead | Board B: Right Red Rail (+3.3V) | **SOLDERING COMPLETE (Ready to Plug)** |
| `W-5.2` | Sensor 5: DS18B20 GND | **BLACK** | Soldered & Ready | Wire/F-M | DS18B20 BLACK Lead | Board B: Right Blue Rail (GND) | **SOLDERING COMPLETE (Ready to Plug)** |
| `W-5.3` | Sensor 5: DS18B20 DATA | **YELLOW** / Any | Soldered & Ready | Wire/F-M | DS18B20 DATA Lead | Board B: Row 11 Col b (GPIO 4 / D4) | **SOLDERING COMPLETE (Ready to Plug)** |
| `R-5.1` | Sensor 5: 4.7 kΩ Pull-up | *Yellow-Violet-Red* | Available | Passive | Board B: Row 11 Col c | Board B: Right Red Rail (+3.3V) | Pending Insertion |
| `W-6.1` | HMI: 16x2 LCD VCC | **RED** | **RED** (Board B +3.3V Rail) | F-M | HW-61 `VCC` Pin | Board B: Right Red Rail (+3.3V) | **VERIFIED (Active)** |
| `W-6.2` | HMI: 16x2 LCD GND | **BLACK** / **BLUE** | **BROWN** | F-M | HW-61 `GND` Pin | Board B: Right Blue Rail (GND) | **VERIFIED (Active)** |
| `W-6.3` | HMI: 16x2 LCD SDA | **GREEN** / Any | **WHITE** | F-M | HW-61 `SDA` Pin | Board B: Row 5 Col c (GPIO 21 / SDA) | **VERIFIED (Active)** |
| `W-6.4` | HMI: 16x2 LCD SCL | **YELLOW** / Any | **ORANGE** | F-M | HW-61 `SCL` Pin | Board B: Row 2 Col c (GPIO 22 / SCL) | **VERIFIED (Active)** |
| `W-7.1` | Sensor 6: ACS712 VCC (+5V) | **RED** | **GREEN** | F-M | ACS712 `VCC` Pin | Board A: Left Red Rail (+5V) | **VERIFIED (Active)** |
| `W-7.2` | Sensor 6: ACS712 GND | **BLACK** / **BLUE** | **BROWN** | F-M | ACS712 `GND` Pin | Board A: Left Blue Rail (GND) | **VERIFIED (Active)** |
| `W-7.3` | Sensor 6: ACS712 OUT | **YELLOW** / Any | **WHITE** | F-M | ACS712 `OUT` Pin | Board A: Row 7 Col i (GPIO 33 / D33) | **VERIFIED (Active)** |
| `W-8.1` | Actuator 1: Relay VCC (+5V) | **RED** | **PURPLE** | F-M | CW-020 `VCC` / `DC+` Pin | Board A: Left Red Rail (+5V) | **VERIFIED (Active)** |
| `W-8.2` | Actuator 1: Relay GND | **BLACK** / **BLUE** | **BROWN** | F-M | CW-020 `GND` / `DC-` Pin | Board A: Left Blue Rail (GND) | **VERIFIED (Active)** |
| `W-8.3` | Actuator 1: Relay IN | **BLUE** / Any | **GREEN** | F-M | CW-020 `IN` Pin | Board A: Row 9 Col i (GPIO 26 / D26) | **VERIFIED (Active)** |
| `W-9.1` | Indicator: Green Signal Jumper | **GREEN** / Any | **GREEN** | M-M | Board B: Row 1 Col b (D23) | Board B: Row 26 Col b | **VERIFIED (Active)** |
| `LED-1` | Indicator: Green Status LED | **GREEN LED** | **GREEN LED** | LED | Anode (+) in Board B: Row 26 Col c | Cathode (-) in Board B: Row 27 Col c | **VERIFIED (Active)** |
| `R-LED1` | Indicator: Green 390Ω Resistor | *Orange-White-Brown* | **390 Ω (Orange-White-Brown)** | Passive | Board B: Row 27 Col d | Board B: Right Blue Rail (GND) | **VERIFIED (Active)** |
| `W-9.2` | Indicator: Red Signal Jumper | **RED** / Any | **M-M Jumper** | M-M | Board A: Row 13 Col i (D13) | Board A: Row 26 Col i | **VERIFIED (Active)** |
| `LED-2` | Indicator: Red Alarm LED | **RED LED** | **RED LED** | LED | Anode (+) in Board A: Row 26 Col h | Cathode (-) in Board A: Row 27 Col h | **VERIFIED (Active)** |
| `R-LED2` | Indicator: Red 390Ω Resistor | *Orange-White-Brown* | **390 Ω (Orange-White-Brown)** | Passive | Board A: Row 27 Col g | Board A: Left Blue Rail (GND) | **VERIFIED (Active)** |
| `PWR-1` | 12V DC Barrel Jack (+12V) | **RED** | **RED (Tested +12V)** | Soldered | DC Jack Center Pin Tab | 12V Power Bus / Screw Terminal | **VERIFIED (Active)** |
| `PWR-2` | 12V DC Barrel Jack (GND) | **BLACK** | **BLACK (Tested GND)** | Soldered | DC Jack Sleeve Leaf Tab | 12V Return / Common Ground | **VERIFIED (Active)** |
