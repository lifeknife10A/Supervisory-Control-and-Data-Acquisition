import csv
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

CSV_PATH = "SCADA_Components_Bill_of_Materials.csv"
XLSX_PATH = "SCADA_Components_Bill_of_Materials.xlsx"

HEADERS = [
    "Item #",
    "Component Name",
    "Category",
    "Model / Specification",
    "Operating Voltage & Interface",
    "Role in SCADA Plant",
    "Audit & Safety Justification",
    "Qty"
]

ITEMS = [
    # 1. Compute
    [1, "ESP32 DevKit V1", "Compute Node", "30-Pin Dual-Core (ESP-WROOM-32)", "5V VIN / 3.3V Logic, Wi-Fi & BLE", "Master Edge Controller & Modbus/HTTP RTU Node", "Main compute and wireless telemetry transmitter", 1],
    
    # 2. Sensors
    [2, "HC-SR04 Ultrasonic Sensor", "Sensor", "Ultrasonic distance transducer (2-400 cm)", "5V DC VCC, Echo via 1k/1.5k divider into GPIO 34", "Tank Water Level Measurement (0–100%)", "Non-contact liquid level telemetry", 1],
    [3, "DS18B20 Temp Probe", "Sensor", "Waterproof stainless steel probe (-55°C to 125°C)", "3.3V VDD (1-Wire GPIO 4 with 4.7kΩ pull-up)", "Reactor / Process Vessel Temperature", "Digital single-bus thermal monitoring", 1],
    [4, "MQ-2 Gas / Smoke Sensor", "Sensor", "MOS Combustible Gas Detector (LPG, Smoke)", "5V DC VCC (AO via 10k/15k divider into GPIO 32)", "Hazardous Gas Leak & Fire Smoke Detection", "Early fire & hazardous vapor detection", 1],
    [5, "ACS712 Current Sensor", "Sensor", "Hall-effect linear current module (±5A range)", "5V DC VCC (OUT via 10k/15k divider into GPIO 33)", "Pump Motor Current & Jam/Cavitation Detection", "Motor operational health & electrical load monitoring", 1],
    
    # 3. Actuators & Drivers
    [6, "5V Relay Module", "Actuator Driver", "1-Channel Optocoupled Board (10A 250VAC/30VDC)", "5V VCC, 3.3V Trigger (GPIO 26)", "Inflow Submersible Pump Power Interlock", "Galvanic isolation for inductive pump switching", 1],
    [7, "Submersible Water Pump", "Actuator", "12V / 5V DC Mini Centrifugal Water Pump", "12V/5V DC (Switched via Relay contacts)", "Process Inflow Water Circulation Actuator", "Automated tank filling and level replenishment", 1],
    [8, "Solenoid Drain Valve", "Actuator", "12V DC Normally Closed Gravity Solenoid Valve", "12V DC (Switched via MOSFET Module, GPIO 27)", "Emergency Tank Overfill Relief Drain", "Rapid tank drainage under high-level or fault states", 1],
    [9, "DC Exhaust / Cooling Fan", "Actuator", "12V DC Brushless Exhaust Fan (40x40x10 mm)", "12V DC (Switched via MOSFET Module, GPIO 14)", "Hazardous Gas Dispersion & Thermal Cooling", "Active ventilation during gas alarm or high temp", 1],
    [10, "12V MOSFET Driver Modules", "Actuator Driver", "LR7843 / AOD4184 Logic-Level N-MOSFET Board", "3.3V Logic Trigger, 12V Load Switching", "Dedicated Drivers for Solenoid Valve & Fan", "Prevents drawing motor/coil currents through ESP32", 2],
    
    # 4. Local HMI & Indicators
    [11, "16x2 Character LCD Display", "Local HMI", "HD44780 LCD with PCF8574 I2C Backpack", "5V DC (I2C via Level Shifter, SDA=21, SCL=22)", "Local Operator Control Room Status Display", "Stand-alone visual readout independent of network", 1],
    [12, "Bi-Directional I2C Level Shifter", "Signal Interface", "2-Channel / 4-Channel BSS138-based Module", "3.3V Low-Voltage <-> 5.0V High-Voltage", "LCD SDA/SCL Level Translation (GPIO 21/22)", "Protects ESP32 GPIOs from 5V I2C pull-up leakage", 1],
    [13, "5mm Green LED", "Visual Indicator", "Diffused Through-hole LED (2.0V-2.2V forward)", "3.3V Output via 220Ω resistor (GPIO 23)", "Normal Operation / System Healthy Indicator", "Reassigned to safe GPIO 23 to avoid boot strapping", 1],
    [14, "5mm Red LED", "Visual Indicator", "Diffused Through-hole LED (1.8V-2.0V forward)", "3.3V Output via 220Ω resistor (GPIO 13)", "Critical Alarm Trip & Emergency Shutdown Strobe", "Reassigned to safe GPIO 13 to avoid boot strapping", 1],
    
    # 5. Passive Components (Dividers, Pull-ups, Protection)
    [15, "4.7 kΩ Resistor", "Passive", "1/4-Watt 5% Carbon/Metal Film", "Passive (Between +3.3V and GPIO 4)", "Pull-up Resistor for DS18B20 1-Wire Data Line", "Mandatory pull-up spanning distinct rows 16 & 17", 1],
    [16, "1.0 kΩ Resistor", "Passive", "1/4-Watt 5% Carbon Film", "Passive (Upper leg of Echo voltage divider)", "HC-SR04 Echo 5V-to-3V Stepped-down Divider", "Form 3.0V divider with 1.5kΩ to protect GPIO 34", 1],
    [17, "1.5 kΩ Resistor", "Passive", "1/4-Watt 5% Carbon Film", "Passive (Lower leg of Echo voltage divider to GND)", "HC-SR04 Echo 5V-to-3V Stepped-down Divider", "Ensures Echo output voltage never exceeds 3.15V", 1],
    [18, "10 kΩ Resistors", "Passive", "1/4-Watt 5% Carbon Film", "Passive (Upper legs of 0.6x ADC dividers)", "Voltage Attenuation for MQ-2 and ACS712", "Upper resistors for scaling 0–5V down to 0–3.0V", 2],
    [19, "15 kΩ Resistors", "Passive", "1/4-Watt 5% Carbon Film", "Passive (Lower legs of 0.6x ADC dividers to GND)", "Voltage Attenuation for MQ-2 and ACS712", "Lower resistors producing precise 0.6x attenuation", 2],
    [20, "220 Ω Resistors", "Passive", "1/4-Watt 5% Carbon Film", "Passive (In series with LED anodes)", "Current Limiting for Green & Red Status LEDs", "Limits GPIO sink/source current safely to ~6–8 mA", 2],
    [21, "100 kΩ Resistors", "Passive", "1/4-Watt 5% Carbon Film", "Passive (Gate-to-GND on MOSFET Drivers)", "Gate Pull-down Resistors for Solenoid & Fan", "Guarantees actuators remain OFF during ESP32 boot", 2],
    [22, "1N4007 Flyback Diodes", "Protection", "1A, 1000V Standard Recovery Rectifier", "Reverse-biased across 12V inductive coils", "Transient Snubber for Solenoid Valve & Fan Motor", "Clamps inductive kickback spikes upon de-energizing", 2],
    
    # 6. Prototyping & Power Infrastructure
    [23, "MB-102 Breadboard", "Prototyping", "830 Tie-point Solderless Breadboard", "Dual Power Rails (+5V, GND, +3.3V)", "Circuit Prototyping & Module Interconnection", "Central chassis with verified row isolation", 1],
    [24, "Jumper Wires Assortment", "Wiring", "Male-to-Male, Male-to-Female, Female-to-Female", "Standard 24-28 AWG, Multi-color", "Inter-module Signal & Power Routing", "Flexible routing of signals, power, and ground", 50],
    [25, "5V 2A DC Power Supply", "Power Supply", "Regulated 5V DC Wall Adapter / USB Supply", "5.0V DC, 2000 mA Regulated", "Main Power for ESP32 VIN, MQ-2 Heater, Relay Coil", "Separates logic power from noisy motor supplies", 1],
    [26, "12V 2A–3A DC Power Supply", "Power Supply", "Regulated 12V DC Adapter (Switching)", "12.0V DC, 2000–3000 mA Regulated", "Dedicated Actuator Power Bus (Pump, Valve, Fan)", "Eliminates voltage brownout resets on ESP32", 1],
    [27, "DC Barrel Jack to Screw Terminals", "Connector", "5.5mm x 2.1mm Female to 2-Pin Screw Block", "Rated up to 36V DC, 5A", "Power Distribution Interface for 12V & 5V Buses", "Secure, low-resistance connections for power rails", 2],
]

# 1. Write CSV
with open(CSV_PATH, mode="w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(["INDUSTRY 4.0 DISTRIBUTED SCADA - HARDENED BILL OF MATERIALS (BOM)"])
    writer.writerow(["Project: Physical ESP32 Hardware + LabVIEW Master Dashboard + Python AI Predictive Safety Twin (Post-Audit Hardened V2.0)"])
    writer.writerow([])
    writer.writerow(HEADERS)
    for row in ITEMS:
        writer.writerow(row)
    total_qty = sum(row[7] for row in ITEMS)
    writer.writerow(["", "TOTAL UNIQUE COMPONENTS", "", "", "", "", "TOTAL QUANTITY", total_qty])

print(f"Updated CSV saved to {CSV_PATH}")

# 2. Write Styled XLSX
wb = openpyxl.Workbook()
ws = wb.active
ws.title = "SCADA Hardware BOM V2.0"

# Title block
ws.merge_cells("A1:H1")
ws["A1"] = "INDUSTRY 4.0 DISTRIBUTED SCADA - MASTER BILL OF MATERIALS (V2.0 HARDENED)"
ws["A1"].font = Font(name="Calibri", size=15, bold=True, color="FFFFFF")
ws["A1"].fill = PatternFill(start_color="1F497D", end_color="1F497D", fill_type="solid")
ws["A1"].alignment = Alignment(horizontal="center", vertical="center")
ws.row_dimensions[1].height = 35

ws.merge_cells("A2:H2")
ws["A2"] = "Audit-Verified Specification: ESP32 Edge Node + LabVIEW Dashboard + Python FastAPI AI Predictive Safety Twin"
ws["A2"].font = Font(name="Calibri", size=10, italic=True, color="DCE6F1")
ws["A2"].fill = PatternFill(start_color="2C5282", end_color="2C5282", fill_type="solid")
ws["A2"].alignment = Alignment(horizontal="center", vertical="center")
ws.row_dimensions[2].height = 20

# Header row
ws.append([]) # blank row 3
ws.append(HEADERS) # row 4
ws.row_dimensions[4].height = 28

thin_border = Border(
    left=Side(style='thin', color='D9D9D9'),
    right=Side(style='thin', color='D9D9D9'),
    top=Side(style='thin', color='D9D9D9'),
    bottom=Side(style='thin', color='D9D9D9')
)

header_fill = PatternFill(start_color="2B6CB0", end_color="2B6CB0", fill_type="solid")
header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")

for col_idx in range(1, 9):
    cell = ws.cell(row=4, column=col_idx)
    cell.fill = header_fill
    cell.font = header_font
    cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

# Data rows
cat_colors = {
    "Compute Node": "EBF8FF",
    "Sensor": "E6FFFA",
    "Actuator": "FEFCBF",
    "Actuator Driver": "FEEBC8",
    "Local HMI": "FAF5FF",
    "Signal Interface": "EDF2F7",
    "Visual Indicator": "FFF5F5",
    "Passive": "F7FAFC",
    "Protection": "FED7D7",
    "Prototyping": "F0FFF4",
    "Wiring": "F0FFF4",
    "Power Supply": "ED8936",
    "Connector": "E2E8F0"
}

start_row = 5
for idx, item in enumerate(ITEMS):
    row_num = start_row + idx
    ws.append(item)
    ws.row_dimensions[row_num].height = 22
    
    cat = item[2]
    bg_color = cat_colors.get(cat, "FFFFFF")
    row_fill = PatternFill(start_color=bg_color, end_color=bg_color, fill_type="solid")
    
    for col_idx in range(1, 9):
        cell = ws.cell(row=row_num, column=col_idx)
        cell.border = thin_border
        cell.font = Font(name="Calibri", size=10)
        
        # Alignments
        if col_idx in (1, 8):  # Item # and Qty
            cell.alignment = Alignment(horizontal="center", vertical="center")
        elif col_idx in (2, 3):  # Name & Category
            cell.alignment = Alignment(horizontal="left", vertical="center")
            cell.font = Font(name="Calibri", size=10, bold=(col_idx==2))
        else:
            cell.alignment = Alignment(horizontal="left", vertical="center")

# Total row
tot_row = start_row + len(ITEMS)
ws.row_dimensions[tot_row].height = 26
ws.cell(row=tot_row, column=1, value="")
ws.cell(row=tot_row, column=2, value="TOTAL HARDWARE QUANTITY")
ws.cell(row=tot_row, column=2).font = Font(name="Calibri", size=11, bold=True, color="1A202C")
ws.cell(row=tot_row, column=7, value="TOTAL UNITS:")
ws.cell(row=tot_row, column=7).font = Font(name="Calibri", size=11, bold=True, color="1A202C")
ws.cell(row=tot_row, column=7).alignment = Alignment(horizontal="right", vertical="center")

tot_cell = ws.cell(row=tot_row, column=8, value=f"=SUM(H{start_row}:H{tot_row-1})")
tot_cell.font = Font(name="Calibri", size=11, bold=True, color="1A365D")
tot_cell.fill = PatternFill(start_color="BEE3F8", end_color="BEE3F8", fill_type="solid")
tot_cell.alignment = Alignment(horizontal="center", vertical="center")
tot_cell.border = Border(top=Side(style='thin', color='2B6CB0'), bottom=Side(style='double', color='2B6CB0'))

# Auto-fit column widths
col_widths = {
    1: 8,   # Item #
    2: 28,  # Component Name
    3: 18,  # Category
    4: 38,  # Model / Spec
    5: 38,  # Operating Voltage & Interface
    6: 38,  # Role in SCADA Plant
    7: 42,  # Audit & Safety Justification
    8: 10   # Qty
}

for col_idx, width in col_widths.items():
    col_letter = get_column_letter(col_idx)
    ws.column_dimensions[col_letter].width = width

wb.save(XLSX_PATH)
print(f"Updated Styled Excel saved to {XLSX_PATH}")
