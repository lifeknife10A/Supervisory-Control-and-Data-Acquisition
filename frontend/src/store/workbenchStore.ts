import { create } from 'zustand';
import type {
  WorkbenchComponent,
  WireConnection,
  WireDraft,
  LiveTelemetry,
  PinDefinition,
  SerialLogEntry,
} from '../types/workbench';
import {
  type MCUState,
  getInitialMCUState,
  generateBootLogs,
  executeMCUControlStep,
  executeSerialCLICommand,
} from './mcuSimulationEngine';
import {
  validateCircuitGraph,
  type CircuitHealthReport,
} from './circuitValidator';

export function generateESP32Pins(): PinDefinition[] {
  const zStart = -0.36;
  const zStep = 0.052;
  const y = 0.085;
  const xLeft = -0.22;
  const xRight = 0.22;

  const leftPinDefs: { id: string; name: string; type: PinDefinition['type'] }[] = [
    { id: 'pin_en', name: 'EN (Reset)', type: 'DIGITAL_GPIO' },
    { id: 'pin_gpio36', name: 'VP / GPIO 36 (Sensor VP)', type: 'ANALOG' },
    { id: 'pin_gpio39', name: 'VN / GPIO 39 (Sensor VN)', type: 'ANALOG' },
    { id: 'pin_gpio34', name: 'GPIO 34 (Tank Level Echo ADC)', type: 'ANALOG' },
    { id: 'pin_gpio35', name: 'GPIO 35 (Reactor Temp ADC)', type: 'ANALOG' },
    { id: 'pin_gpio32', name: 'GPIO 32 (Gas PPM ADC)', type: 'ANALOG' },
    { id: 'pin_gpio33', name: 'GPIO 33 (Current ADC)', type: 'ANALOG' },
    { id: 'pin_gpio25', name: 'GPIO 25 (Ultrasonic Trig Out)', type: 'DIGITAL_GPIO' },
    { id: 'pin_gpio26', name: 'GPIO 26 (Pump Relay IN1)', type: 'DIGITAL_GPIO' },
    { id: 'pin_gpio27', name: 'GPIO 27 (Emergency Valve Solenoid)', type: 'DIGITAL_GPIO' },
    { id: 'pin_gpio14', name: 'GPIO 14 (Exhaust Fan Control)', type: 'DIGITAL_GPIO' },
    { id: 'pin_gpio12', name: 'GPIO 12 (Alarm Red LED)', type: 'DIGITAL_GPIO' },
    { id: 'pin_gpio13', name: 'GPIO 13 (Status Output)', type: 'DIGITAL_GPIO' },
    { id: 'pin_gnd_1', name: 'GND (Ground)', type: 'GROUND' },
    { id: 'pin_vin', name: 'VIN (5V Supply In)', type: 'POWER_VCC' },
  ];

  const rightPinDefs: { id: string; name: string; type: PinDefinition['type'] }[] = [
    { id: 'pin_3v3', name: '3.3V (Regulated Out)', type: 'POWER_VCC' },
    { id: 'pin_gnd_2', name: 'GND (Ground)', type: 'GROUND' },
    { id: 'pin_gpio15', name: 'GPIO 15 (HSPI_CS)', type: 'DIGITAL_GPIO' },
    { id: 'pin_gpio2', name: 'GPIO 2 (Built-in Blue LED)', type: 'DIGITAL_GPIO' },
    { id: 'pin_gpio4', name: 'GPIO 4 (1-Wire Bidirectional)', type: 'DIGITAL_GPIO' },
    { id: 'pin_gpio16', name: 'GPIO 16 (RX2)', type: 'DIGITAL_GPIO' },
    { id: 'pin_gpio17', name: 'GPIO 17 (TX2)', type: 'DIGITAL_GPIO' },
    { id: 'pin_gpio5', name: 'GPIO 5 (VSPI_CS)', type: 'DIGITAL_GPIO' },
    { id: 'pin_gpio18', name: 'GPIO 18 (VSPI_CLK)', type: 'DIGITAL_GPIO' },
    { id: 'pin_gpio19', name: 'GPIO 19 (VSPI_MISO)', type: 'DIGITAL_GPIO' },
    { id: 'pin_gpio21', name: 'GPIO 21 (I2C SDA)', type: 'I2C' },
    { id: 'pin_gpio3', name: 'GPIO 3 (U0RXD)', type: 'DIGITAL_GPIO' },
    { id: 'pin_gpio1', name: 'GPIO 1 (U0TXD)', type: 'DIGITAL_GPIO' },
    { id: 'pin_gpio22', name: 'GPIO 22 (I2C SCL)', type: 'I2C' },
    { id: 'pin_gpio23', name: 'GPIO 23 (VSPI_MOSI)', type: 'DIGITAL_GPIO' },
  ];

  const pins: PinDefinition[] = [];
  leftPinDefs.forEach((p, idx) => {
    pins.push({
      ...p,
      relativePosition: [xLeft, y, parseFloat((zStart + idx * zStep).toFixed(4))],
    });
  });
  rightPinDefs.forEach((p, idx) => {
    pins.push({
      ...p,
      relativePosition: [xRight, y, parseFloat((zStart + idx * zStep).toFixed(4))],
    });
  });

  return pins;
}

export function generateBreadboardPins(): PinDefinition[] {
  const pins: PinDefinition[] = [];
  const planeWidth = 2.36;
  const planeHeight = 1.26;
  const yPos = 0.105;

  const getPos = (px: number, py: number): [number, number, number] => {
    const x = (px / 2048 - 0.5) * planeWidth;
    const z = (py / 1100 - 0.5) * planeHeight;
    return [parseFloat(x.toFixed(4)), yPos, parseFloat(z.toFixed(4))];
  };

  const topRows = ['a', 'b', 'c', 'd', 'e'];
  const topPy = [270, 320, 370, 420, 470];
  const botRows = ['f', 'g', 'h', 'i', 'j'];
  const botPy = [630, 680, 730, 780, 830];

  for (let col = 0; col < 30; col++) {
    const px = 150 + col * 58;
    const colNum = col + 1;

    // Top VCC (+)
    pins.push({
      id: `top_vcc_${colNum}`,
      name: `Top VCC (+) Col ${colNum}`,
      type: 'POWER_VCC',
      relativePosition: getPos(px, 100),
    });
    // Top GND (-)
    pins.push({
      id: `top_gnd_${colNum}`,
      name: `Top GND (-) Col ${colNum}`,
      type: 'GROUND',
      relativePosition: getPos(px, 180),
    });

    // Rows a, b, c, d, e
    for (let r = 0; r < 5; r++) {
      pins.push({
        id: `tie_${colNum}${topRows[r]}`,
        name: `Terminal ${colNum}-${topRows[r].toUpperCase()}`,
        type: 'DIGITAL_GPIO',
        relativePosition: getPos(px, topPy[r]),
      });
    }

    // Rows f, g, h, i, j
    for (let r = 0; r < 5; r++) {
      pins.push({
        id: `tie_${colNum}${botRows[r]}`,
        name: `Terminal ${colNum}-${botRows[r].toUpperCase()}`,
        type: 'DIGITAL_GPIO',
        relativePosition: getPos(px, botPy[r]),
      });
    }

    // Bottom GND (-)
    pins.push({
      id: `bot_gnd_${colNum}`,
      name: `Bottom GND (-) Col ${colNum}`,
      type: 'GROUND',
      relativePosition: getPos(px, 935),
    });

    // Bottom VCC (+)
    pins.push({
      id: `bot_vcc_${colNum}`,
      name: `Bottom VCC (+) Col ${colNum}`,
      type: 'POWER_VCC',
      relativePosition: getPos(px, 1015),
    });
  }

  // Backward-compatible aliases
  pins.push(
    { id: 'rail_vcc_top', name: 'Top VCC (+5V Rail)', type: 'POWER_VCC', relativePosition: getPos(150 + 9 * 58, 100) },
    { id: 'rail_vcc_top_r', name: 'Top VCC (+5V Rail Right)', type: 'POWER_VCC', relativePosition: getPos(150 + 20 * 58, 100) },
    { id: 'rail_gnd_top', name: 'Top GND (Ground Rail)', type: 'GROUND', relativePosition: getPos(150 + 9 * 58, 180) },
    { id: 'rail_gnd_top_r', name: 'Top GND (Ground Rail Right)', type: 'GROUND', relativePosition: getPos(150 + 20 * 58, 180) },
    { id: 'rail_gnd_bot', name: 'Bottom GND (Ground Rail)', type: 'GROUND', relativePosition: getPos(150 + 9 * 58, 935) },
    { id: 'rail_gnd_bot_r', name: 'Bottom GND (Ground Rail Right)', type: 'GROUND', relativePosition: getPos(150 + 20 * 58, 935) },
    { id: 'rail_vcc_bot', name: 'Bottom VCC (+5V Rail)', type: 'POWER_VCC', relativePosition: getPos(150 + 9 * 58, 1015) },
    { id: 'rail_vcc_bot_r', name: 'Bottom VCC (+5V Rail Right)', type: 'POWER_VCC', relativePosition: getPos(150 + 20 * 58, 1015) },
    { id: 'tie_r5_e', name: 'Tie Point Row 5-E', type: 'DIGITAL_GPIO', relativePosition: getPos(150 + 4 * 58, 470) },
    { id: 'tie_r10_e', name: 'Tie Point Row 10-E', type: 'DIGITAL_GPIO', relativePosition: getPos(150 + 9 * 58, 470) },
    { id: 'tie_r15_e', name: 'Tie Point Row 15-E', type: 'DIGITAL_GPIO', relativePosition: getPos(150 + 14 * 58, 470) },
    { id: 'tie_r20_e', name: 'Tie Point Row 20-E', type: 'DIGITAL_GPIO', relativePosition: getPos(150 + 19 * 58, 470) },
    { id: 'tie_r25_e', name: 'Tie Point Row 25-E', type: 'DIGITAL_GPIO', relativePosition: getPos(150 + 24 * 58, 470) },
    { id: 'tie_r5_f', name: 'Tie Point Row 5-F', type: 'DIGITAL_GPIO', relativePosition: getPos(150 + 4 * 58, 630) },
    { id: 'tie_r10_f', name: 'Tie Point Row 10-F', type: 'DIGITAL_GPIO', relativePosition: getPos(150 + 9 * 58, 630) },
    { id: 'tie_r15_f', name: 'Tie Point Row 15-F', type: 'DIGITAL_GPIO', relativePosition: getPos(150 + 14 * 58, 630) },
    { id: 'tie_r20_f', name: 'Tie Point Row 20-F', type: 'DIGITAL_GPIO', relativePosition: getPos(150 + 19 * 58, 630) },
    { id: 'tie_r25_f', name: 'Tie Point Row 25-F', type: 'DIGITAL_GPIO', relativePosition: getPos(150 + 24 * 58, 630) },
  );

  return pins;
}

export const COMPONENT_CATALOG: Omit<WorkbenchComponent, 'id' | 'position' | 'rotation'>[] = [
  {
    type: 'breadboard',
    name: 'MB-102 Breadboard',
    modelPath: '/models/breadboard.glb',
    scale: [1, 1, 1],
    pins: generateBreadboardPins(),
  },
  {
    type: 'esp32',
    name: 'ESP32 DevKit V1',
    modelPath: '/models/esp32.glb',
    scale: [1, 1, 1],
    pins: generateESP32Pins(),
  },
  {
    type: 'hc_sr04',
    name: 'HC-SR04 Level Sensor',
    modelPath: '/models/hc_sr04.glb',
    scale: [1, 1, 1],
    // Header pin row measured off the actual mesh (top-back edge, between the
    // two transducer domes) - previously z=0 sat mid-depth of the board, off
    // the real header by roughly a third of the board's depth.
    pins: [
      { id: 'vcc', name: 'VCC (5V)', type: 'POWER_VCC', relativePosition: [-0.11, 0.38, -0.045] },
      { id: 'trig', name: 'TRIG Pulse Out', type: 'DIGITAL_GPIO', relativePosition: [-0.037, 0.38, -0.045] },
      { id: 'echo', name: 'ECHO Echo In', type: 'ANALOG', relativePosition: [0.037, 0.38, -0.045] },
      { id: 'gnd', name: 'GND', type: 'GROUND', relativePosition: [0.11, 0.38, -0.045] },
    ]
  },
  {
    type: 'ds18b20',
    name: 'DS18B20 Temp Probe',
    modelPath: '/models/ds18b20.glb',
    scale: [1, 1, 1],
    pins: [
      { id: 'vcc', name: 'VCC (3.3V-5V)', type: 'POWER_VCC', relativePosition: [-0.025, 0.02, 0.0] },
      { id: 'data', name: 'DATA (1-Wire)', type: 'DIGITAL_GPIO', relativePosition: [0.0, 0.02, 0.0] },
      { id: 'gnd', name: 'GND', type: 'GROUND', relativePosition: [0.025, 0.02, 0.0] },
    ]
  },
  {
    type: 'mq2',
    name: 'MQ-2 Gas Sensor',
    modelPath: '/models/mq2.glb',
    scale: [1, 1, 1],
    pins: [
      { id: 'vcc', name: 'VCC (5V)', type: 'POWER_VCC', relativePosition: [-0.056, 0.52, -0.142] },
      { id: 'gnd', name: 'GND', type: 'GROUND', relativePosition: [-0.019, 0.52, -0.142] },
      { id: 'do', name: 'Digital Out (DO)', type: 'DIGITAL_GPIO', relativePosition: [0.019, 0.52, -0.142] },
      { id: 'ao', name: 'Analog Out (AO)', type: 'ANALOG', relativePosition: [0.056, 0.52, -0.142] },
    ]
  },
  {
    type: 'acs712',
    name: 'ACS712 Current Board',
    modelPath: '/models/acs712.glb',
    scale: [1, 1, 1],
    pins: [
      { id: 'vcc', name: 'VCC (5V)', type: 'POWER_VCC', relativePosition: [0.08, 0.05, 0.08] },
      { id: 'out', name: 'OUT (Analog)', type: 'ANALOG', relativePosition: [0.08, 0.05, 0.0] },
      { id: 'gnd', name: 'GND', type: 'GROUND', relativePosition: [0.08, 0.05, -0.08] },
      { id: 'ip_plus', name: 'IP+ (Motor Load In)', type: 'POWER_VCC', relativePosition: [-0.08, 0.05, 0.05] },
      { id: 'ip_minus', name: 'IP- (Motor Feed Out)', type: 'GROUND', relativePosition: [-0.08, 0.05, -0.05] },
    ]
  },
  {
    type: 'relay',
    name: '5V Relay Module',
    modelPath: '/models/relay.glb',
    scale: [1, 1, 1],
    pins: [
      { id: 'vcc', name: 'VCC (5V)', type: 'POWER_VCC', relativePosition: [0.32, 0.05, -0.06] },
      { id: 'gnd', name: 'GND', type: 'GROUND', relativePosition: [0.32, 0.05, 0.0] },
      { id: 'in', name: 'IN Control (GPIO 26)', type: 'DIGITAL_GPIO', relativePosition: [0.32, 0.05, 0.06] },
      { id: 'no', name: 'Normally Open (NO)', type: 'RELAY_CONTACT', relativePosition: [-0.32, 0.05, -0.08] },
      { id: 'com', name: 'Common (COM - Supply)', type: 'RELAY_CONTACT', relativePosition: [-0.32, 0.05, 0.0] },
      { id: 'nc', name: 'Normally Closed (NC)', type: 'RELAY_CONTACT', relativePosition: [-0.32, 0.05, 0.08] },
    ]
  },
  {
    type: 'valve',
    name: '12V/5V Solenoid Drain Valve Driver',
    modelPath: '/models/relay.glb',
    scale: [0.85, 0.85, 0.85],
    pins: [
      { id: 'vcc', name: 'VCC (+5V Supply)', type: 'POWER_VCC', relativePosition: [0.32, 0.05, -0.06] },
      { id: 'gnd', name: 'GND (Common Return)', type: 'GROUND', relativePosition: [0.32, 0.05, 0.0] },
      { id: 'in', name: 'IN (GPIO 27 Driver)', type: 'DIGITAL_GPIO', relativePosition: [0.32, 0.05, 0.06] },
      { id: 'no', name: 'Valve NO (Solenoid Out)', type: 'RELAY_CONTACT', relativePosition: [-0.32, 0.05, -0.08] },
      { id: 'com', name: 'Valve COM (+12V/5V In)', type: 'RELAY_CONTACT', relativePosition: [-0.32, 0.05, 0.0] },
      { id: 'nc', name: 'Valve NC (Spare)', type: 'RELAY_CONTACT', relativePosition: [-0.32, 0.05, 0.08] },
    ]
  },
  {
    type: 'lcd_1602',
    name: '16x2 I2C LCD Screen',
    modelPath: '/models/lcd_1602.glb',
    // Bumped up from true 1:1 scale - at real-world size the LCD reads as
    // tiny next to the intentionally oversized breadboard/wire props elsewhere
    // in this scene. Pin/wire endpoints scale with it (see JumperWire3D/DraftWire3D).
    scale: [1.4, 1.4, 1.4],
    pins: [
      { id: 'gnd', name: 'GND (Ground)', type: 'GROUND', relativePosition: [-0.015, 0.03, -0.008] },
      { id: 'vcc', name: 'VCC (+5V)', type: 'POWER_VCC', relativePosition: [-0.005, 0.03, -0.008] },
      { id: 'sda', name: 'SDA (I2C Data)', type: 'I2C', relativePosition: [0.005, 0.03, -0.008] },
      { id: 'scl', name: 'SCL (I2C Clock)', type: 'I2C', relativePosition: [0.015, 0.03, -0.008] },
    ]
  },
  {
    type: 'fan',
    name: '5V Exhaust Fan Driver Module',
    modelPath: '/models/fan.glb',
    scale: [1, 1, 1],
    // Pins clustered at the real 3-wire cable exit point on the fan housing
    // (measured off the actual mesh geometry - previously spread across the
    // bottom of the frame where there is no cable, so wires floated past it).
    pins: [
      { id: 'vcc', name: 'VCC (+5V Supply)', type: 'POWER_VCC', relativePosition: [0.33, 0.16, 0.07] },
      { id: 'gnd', name: 'GND (Common Return)', type: 'GROUND', relativePosition: [0.33, 0.13, 0.07] },
      { id: 'in', name: 'IN (GPIO 14 Driver)', type: 'DIGITAL_GPIO', relativePosition: [0.33, 0.10, 0.07] },
    ]
  },
  {
    type: 'pump',
    name: '5V Submersible Pump',
    modelPath: '/models/pump.glb',
    scale: [1, 1, 1],
    pins: [
      { id: 'vcc', name: '+5V Switched In (Red)', type: 'POWER_VCC', relativePosition: [-0.15, 0.05, 0.35] },
      { id: 'gnd', name: 'GND (Black)', type: 'GROUND', relativePosition: [0.15, 0.05, 0.35] },
    ]
  },
  {
    type: 'led_green',
    name: '5mm Green LED',
    modelPath: '/models/led_green.glb',
    scale: [1, 1, 1],
    pins: [
      { id: 'anode', name: 'Anode (+)', type: 'DIGITAL_GPIO', relativePosition: [-0.03341796875, 0.002, 0] },
      { id: 'cathode', name: 'Cathode (-)', type: 'GROUND', relativePosition: [0.03341796875, 0.002, 0] },
    ]
  },
  {
    type: 'led_red',
    name: '5mm Red LED',
    modelPath: '/models/led_red.glb',
    scale: [1, 1, 1],
    pins: [
      { id: 'anode', name: 'Anode (+)', type: 'DIGITAL_GPIO', relativePosition: [-0.00127, 0.002, 0] },
      { id: 'cathode', name: 'Cathode (-)', type: 'GROUND', relativePosition: [0.00127, 0.002, 0] },
    ]
  },
  {
    type: 'resistor',
    name: '1/4W Resistor',
    modelPath: '/models/resistor.glb',
    scale: [1, 1, 1],
    pins: [
      { id: 'lead_1', name: 'Lead 1', type: 'DIGITAL_GPIO', relativePosition: [-0.08, 0.03, 0] },
      { id: 'lead_2', name: 'Lead 2', type: 'DIGITAL_GPIO', relativePosition: [0.08, 0.03, 0] },
    ]
  }
];

export const INITIAL_COMPONENTS: WorkbenchComponent[] = [
  {
    id: 'breadboard_1',
    ...COMPONENT_CATALOG.find((c) => c.type === 'breadboard')!,
    position: [0, 0.002, 0],
    rotation: [0, 0, 0],
  },
  {
    id: 'esp32_1',
    ...COMPONENT_CATALOG.find((c) => c.type === 'esp32')!,
    position: [-1.45, 0.005, 0],
    rotation: [0, 0, 0],
  },
  {
    id: 'hc_sr04_1',
    ...COMPONENT_CATALOG.find((c) => c.type === 'hc_sr04')!,
    position: [-1.55, 0.005, -1.05],
    rotation: [0, 0, 0],
  },
  {
    id: 'ds18b20_1',
    ...COMPONENT_CATALOG.find((c) => c.type === 'ds18b20')!,
    position: [-1.45, 0.005, 0.95],
    rotation: [0, 0, 0],
  },
  {
    id: 'mq2_1',
    ...COMPONENT_CATALOG.find((c) => c.type === 'mq2')!,
    position: [1.55, 0.005, -1.05],
    rotation: [0, 0, 0],
  },
  {
    id: 'acs712_1',
    ...COMPONENT_CATALOG.find((c) => c.type === 'acs712')!,
    position: [1.45, 0.005, 0.95],
    rotation: [0, 0, 0],
  },
  {
    id: 'relay_1',
    ...COMPONENT_CATALOG.find((c) => c.type === 'relay')!,
    position: [0.85, 0.005, -1.05],
    rotation: [0, 0, 0],
  },
  {
    id: 'valve_1',
    ...COMPONENT_CATALOG.find((c) => c.type === 'valve')!,
    position: [0.25, 0.005, -1.05],
    rotation: [0, 0, 0],
  },
  {
    id: 'lcd_1',
    ...COMPONENT_CATALOG.find((c) => c.type === 'lcd_1602')!,
    position: [-0.55, 0.005, -1.05],
    rotation: [0, 0, 0],
  },
  {
    id: 'fan_1',
    ...COMPONENT_CATALOG.find((c) => c.type === 'fan')!,
    position: [1.85, 0.005, 0],
    rotation: [0, 0, 0],
  },
  {
    id: 'pump_1',
    ...COMPONENT_CATALOG.find((c) => c.type === 'pump')!,
    position: [-2.05, 0.005, 0],
    rotation: [0, Math.PI / 2, 0],
  },
  {
    id: 'led_green_1',
    ...COMPONENT_CATALOG.find((c) => c.type === 'led_green')!,
    position: [-0.25, 0.005, 0.65],
    rotation: [0, 0, 0],
  },
  {
    id: 'led_red_1',
    ...COMPONENT_CATALOG.find((c) => c.type === 'led_red')!,
    position: [0.25, 0.005, 0.65],
    rotation: [0, 0, 0],
  },
  {
    id: 'resistor_ds18b20',
    ...COMPONENT_CATALOG.find((c) => c.type === 'resistor')!,
    name: '4.7kΩ Pull-Up Resistor (DS18B20)',
    position: [0.0, 0.005, 0.65],
    rotation: [0, 0, 0],
  },
  {
    id: 'resistor_led_g',
    ...COMPONENT_CATALOG.find((c) => c.type === 'resistor')!,
    name: '220Ω Resistor (Green LED)',
    position: [-0.45, 0.005, 0.65],
    rotation: [0, 0, 0],
  },
  {
    id: 'resistor_led_r',
    ...COMPONENT_CATALOG.find((c) => c.type === 'resistor')!,
    name: '220Ω Resistor (Red LED)',
    position: [0.45, 0.005, 0.65],
    rotation: [0, 0, 0],
  },
];

/**
 * Verified, Electrically Sound Industrial SCADA Reference Circuit Netlist
 */
export const SCADA_REFERENCE_WIRES: WireConnection[] = [
  // 1. ESP32 Main 5V, 3.3V & Grounds to Breadboard Power Bus Rails
  { id: 'w_pwr_1', fromComponentId: 'esp32_1', fromPinId: 'pin_vin', toComponentId: 'breadboard_1', toPinId: 'top_vcc_4', color: '#ef4444', sag: 0.35 },
  { id: 'w_pwr_2', fromComponentId: 'esp32_1', fromPinId: 'pin_gnd_1', toComponentId: 'breadboard_1', toPinId: 'top_gnd_4', color: '#111827', sag: 0.3 },
  { id: 'w_pwr_3', fromComponentId: 'esp32_1', fromPinId: 'pin_3v3', toComponentId: 'breadboard_1', toPinId: 'bot_vcc_4', color: '#f59e0b', sag: 0.32 },
  { id: 'w_pwr_4', fromComponentId: 'esp32_1', fromPinId: 'pin_gnd_2', toComponentId: 'breadboard_1', toPinId: 'bot_gnd_4', color: '#111827', sag: 0.3 },

  // Common Ground Bridge across Rails
  { id: 'w_bridge_gnd', fromComponentId: 'breadboard_1', fromPinId: 'top_gnd_28', toComponentId: 'breadboard_1', toPinId: 'bot_gnd_28', color: '#111827', sag: 0.25 },

  // 2. HC-SR04 Level Sensor (5V VCC, GND, TRIG to GPIO 25, ECHO to GPIO 34)
  { id: 'w_hc_1', fromComponentId: 'hc_sr04_1', fromPinId: 'vcc', toComponentId: 'breadboard_1', toPinId: 'top_vcc_8', color: '#ef4444', sag: 0.35 },
  { id: 'w_hc_2', fromComponentId: 'hc_sr04_1', fromPinId: 'gnd', toComponentId: 'breadboard_1', toPinId: 'top_gnd_8', color: '#111827', sag: 0.35 },
  { id: 'w_hc_3', fromComponentId: 'hc_sr04_1', fromPinId: 'trig', toComponentId: 'esp32_1', toPinId: 'pin_gpio25', color: '#10b981', sag: 0.3 },
  { id: 'w_hc_4', fromComponentId: 'hc_sr04_1', fromPinId: 'echo', toComponentId: 'esp32_1', toPinId: 'pin_gpio34', color: '#eab308', sag: 0.32 },

  // 3. DS18B20 Temp Probe (3.3V VCC, GND, DATA to GPIO 4 with 4.7kΩ Pull-Up to 3.3V)
  { id: 'w_ds_1', fromComponentId: 'ds18b20_1', fromPinId: 'vcc', toComponentId: 'breadboard_1', toPinId: 'bot_vcc_8', color: '#ef4444', sag: 0.35 },
  { id: 'w_ds_2', fromComponentId: 'ds18b20_1', fromPinId: 'gnd', toComponentId: 'breadboard_1', toPinId: 'bot_gnd_8', color: '#111827', sag: 0.35 },
  { id: 'w_ds_3', fromComponentId: 'ds18b20_1', fromPinId: 'data', toComponentId: 'esp32_1', toPinId: 'pin_gpio4', color: '#f59e0b', sag: 0.3 },
  { id: 'w_ds_pullup_1', fromComponentId: 'resistor_ds18b20', fromPinId: 'lead_1', toComponentId: 'breadboard_1', toPinId: 'bot_vcc_8', color: '#ef4444', sag: 0.2 },
  { id: 'w_ds_pullup_2', fromComponentId: 'resistor_ds18b20', fromPinId: 'lead_2', toComponentId: 'esp32_1', toPinId: 'pin_gpio4', color: '#f59e0b', sag: 0.25 },

  // 4. MQ-2 Gas & Smoke Sensor (5V VCC, GND, AO to GPIO 32)
  { id: 'w_mq_1', fromComponentId: 'mq2_1', fromPinId: 'vcc', toComponentId: 'breadboard_1', toPinId: 'top_vcc_16', color: '#ef4444', sag: 0.35 },
  { id: 'w_mq_2', fromComponentId: 'mq2_1', fromPinId: 'gnd', toComponentId: 'breadboard_1', toPinId: 'top_gnd_16', color: '#111827', sag: 0.35 },
  { id: 'w_mq_3', fromComponentId: 'mq2_1', fromPinId: 'ao', toComponentId: 'esp32_1', toPinId: 'pin_gpio32', color: '#8b5cf6', sag: 0.3 },

  // 5. Inflow Pump Series Circuit with Relay & ACS712 Current Sensor
  { id: 'w_rel_1', fromComponentId: 'relay_1', fromPinId: 'vcc', toComponentId: 'breadboard_1', toPinId: 'top_vcc_22', color: '#ef4444', sag: 0.35 },
  { id: 'w_rel_2', fromComponentId: 'relay_1', fromPinId: 'gnd', toComponentId: 'breadboard_1', toPinId: 'top_gnd_22', color: '#111827', sag: 0.3 },
  { id: 'w_rel_3', fromComponentId: 'relay_1', fromPinId: 'in', toComponentId: 'esp32_1', toPinId: 'pin_gpio26', color: '#3b82f6', sag: 0.28 },
  { id: 'w_rel_com', fromComponentId: 'relay_1', fromPinId: 'com', toComponentId: 'breadboard_1', toPinId: 'top_vcc_22', color: '#ef4444', sag: 0.25 },
  { id: 'w_rel_acs', fromComponentId: 'relay_1', fromPinId: 'no', toComponentId: 'acs712_1', toPinId: 'ip_plus', color: '#f97316', sag: 0.35 },
  { id: 'w_acs_pmp', fromComponentId: 'acs712_1', fromPinId: 'ip_minus', toComponentId: 'pump_1', toPinId: 'vcc', color: '#f97316', sag: 0.4 },
  { id: 'w_pmp_gnd', fromComponentId: 'pump_1', fromPinId: 'gnd', toComponentId: 'breadboard_1', toPinId: 'top_gnd_24', color: '#111827', sag: 0.38 },

  // ACS712 Logic Power & Analog OUT to GPIO 33
  { id: 'w_acs_1', fromComponentId: 'acs712_1', fromPinId: 'vcc', toComponentId: 'breadboard_1', toPinId: 'top_vcc_18', color: '#ef4444', sag: 0.35 },
  { id: 'w_acs_2', fromComponentId: 'acs712_1', fromPinId: 'gnd', toComponentId: 'breadboard_1', toPinId: 'top_gnd_18', color: '#111827', sag: 0.35 },
  { id: 'w_acs_3', fromComponentId: 'acs712_1', fromPinId: 'out', toComponentId: 'esp32_1', toPinId: 'pin_gpio33', color: '#06b6d4', sag: 0.3 },

  // 6. Solenoid Drain Valve Driver Module (5V VCC, GND, IN from GPIO 27)
  { id: 'w_valve_1', fromComponentId: 'valve_1', fromPinId: 'vcc', toComponentId: 'breadboard_1', toPinId: 'top_vcc_14', color: '#ef4444', sag: 0.35 },
  { id: 'w_valve_2', fromComponentId: 'valve_1', fromPinId: 'gnd', toComponentId: 'breadboard_1', toPinId: 'top_gnd_14', color: '#111827', sag: 0.3 },
  { id: 'w_valve_3', fromComponentId: 'valve_1', fromPinId: 'in', toComponentId: 'esp32_1', toPinId: 'pin_gpio27', color: '#a855f7', sag: 0.3 },

  // 7. Exhaust Fan Driver Module (5V VCC, GND, IN from GPIO 14)
  { id: 'w_fan_1', fromComponentId: 'fan_1', fromPinId: 'vcc', toComponentId: 'breadboard_1', toPinId: 'top_vcc_26', color: '#ef4444', sag: 0.38 },
  { id: 'w_fan_2', fromComponentId: 'fan_1', fromPinId: 'gnd', toComponentId: 'breadboard_1', toPinId: 'top_gnd_26', color: '#111827', sag: 0.35 },
  { id: 'w_fan_3', fromComponentId: 'fan_1', fromPinId: 'in', toComponentId: 'esp32_1', toPinId: 'pin_gpio14', color: '#f97316', sag: 0.4 },

  // 8. 16x2 I2C LCD Display (5V VCC, GND, SDA: GPIO 21, SCL: GPIO 22)
  { id: 'w_lcd_1', fromComponentId: 'lcd_1', fromPinId: 'vcc', toComponentId: 'breadboard_1', toPinId: 'top_vcc_12', color: '#ef4444', sag: 0.35 },
  { id: 'w_lcd_2', fromComponentId: 'lcd_1', fromPinId: 'gnd', toComponentId: 'breadboard_1', toPinId: 'top_gnd_12', color: '#111827', sag: 0.35 },
  { id: 'w_lcd_3', fromComponentId: 'lcd_1', fromPinId: 'sda', toComponentId: 'esp32_1', toPinId: 'pin_gpio21', color: '#3b82f6', sag: 0.3 },
  { id: 'w_lcd_4', fromComponentId: 'lcd_1', fromPinId: 'scl', toComponentId: 'esp32_1', toPinId: 'pin_gpio22', color: '#eab308', sag: 0.3 },

  // 9. Green Indicator LED (GPIO 2 -> 220Ω Series Resistor -> Anode, Cathode to GND)
  { id: 'w_led_g_1', fromComponentId: 'esp32_1', fromPinId: 'pin_gpio2', toComponentId: 'resistor_led_g', toPinId: 'lead_1', color: '#10b981', sag: 0.3 },
  { id: 'w_led_g_2', fromComponentId: 'resistor_led_g', fromPinId: 'lead_2', toComponentId: 'led_green_1', toPinId: 'anode', color: '#10b981', sag: 0.2 },
  { id: 'w_led_g_3', fromComponentId: 'led_green_1', fromPinId: 'cathode', toComponentId: 'breadboard_1', toPinId: 'bot_gnd_18', color: '#111827', sag: 0.28 },

  // 10. Red Alarm Indicator LED (GPIO 12 -> 220Ω Series Resistor -> Anode, Cathode to GND)
  { id: 'w_led_r_1', fromComponentId: 'esp32_1', fromPinId: 'pin_gpio12', toComponentId: 'resistor_led_r', toPinId: 'lead_1', color: '#ef4444', sag: 0.3 },
  { id: 'w_led_r_2', fromComponentId: 'resistor_led_r', fromPinId: 'lead_2', toComponentId: 'led_red_1', toPinId: 'anode', color: '#ef4444', sag: 0.2 },
  { id: 'w_led_r_3', fromComponentId: 'led_red_1', fromPinId: 'cathode', toComponentId: 'breadboard_1', toPinId: 'bot_gnd_24', color: '#111827', sag: 0.28 },
];

export const INITIAL_TELEMETRY: LiveTelemetry = {
  tank_level: 54.2,
  temperature: 29.4,
  gas_ppm: 22.0,
  current_draw: 1.65,
  pump_active: true,
  valve_open: false,
  fan_active: false,
  status_class: 0,
};

const STORAGE_KEY = 'scada_workbench_circuits_v3';

function loadSavedProject(): { components: WorkbenchComponent[]; wires: WireConnection[]; wireRoutingMode?: 'orthogonal' | 'curved' } | null {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined' || !localStorage.getItem) return null;
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('scada_workbench_circuits_v2');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.components) && Array.isArray(parsed.wires) && parsed.components.length > 0) {
      // Strictly normalize all component rotations to 90-degree orthogonal multiples
      const normalizedComps = parsed.components.map((c: WorkbenchComponent) => ({
        ...c,
        rotation: (c.rotation || [0, 0, 0]).map((angle: number) => {
          const snapped = Math.round(angle / (Math.PI / 2)) * (Math.PI / 2);
          return Math.abs(snapped) < 1e-4 ? 0 : parseFloat(snapped.toFixed(4));
        }) as [number, number, number],
      }));

      // Auto-reconcile reference wires (such as w_hc_4 ECHO) if missing from older sessions
      const existingWireIds = new Set(parsed.wires.map((w: WireConnection) => w.id));
      const reconciledWires = [...parsed.wires];
      for (const refWire of SCADA_REFERENCE_WIRES) {
        if (!existingWireIds.has(refWire.id)) {
          const compA = normalizedComps.find((c: WorkbenchComponent) => c.id === refWire.fromComponentId);
          const compB = normalizedComps.find((c: WorkbenchComponent) => c.id === refWire.toComponentId);
          if (compA && compB) {
            reconciledWires.push(refWire);
            existingWireIds.add(refWire.id);
          }
        }
      }

      return {
        components: normalizedComps,
        wires: reconciledWires,
        wireRoutingMode: parsed.wireRoutingMode ?? 'orthogonal',
      };
    }
  } catch (err) {
    console.warn('Could not parse saved workbench state:', err);
  }
  return null;
}

function persistProject(
  components: WorkbenchComponent[],
  wires: WireConnection[],
  wireRoutingMode: 'orthogonal' | 'curved' = 'orthogonal'
) {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined' || !localStorage.setItem) return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ components, wires, wireRoutingMode, version: 3, timestamp: Date.now() })
    );
  } catch (err) {
    console.warn('Could not save workbench state:', err);
  }
}

interface DestructiveConfirmation {
  type: 'clearWires' | 'resetLayout' | 'deleteSelected';
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
}

interface WorkbenchStore {
  components: WorkbenchComponent[];
  selectedComponentIds: string[];
  selectedComponentId: string | null;
  transformMode: 'translate' | 'rotate';
  cameraView: 'iso' | 'top' | 'front';
  isDraggingComponent: boolean;
  isGizmoHovered: boolean;
  isCatalogOpen: boolean;
  isShiftPressed: boolean;
  
  setSelectedComponentIds: (ids: string[]) => void;
  setSelectedComponentId: (id: string | null) => void;
  toggleComponentSelection: (id: string, isMulti?: boolean) => void;
  setTransformMode: (mode: 'translate' | 'rotate') => void;
  setCameraView: (view: 'iso' | 'top' | 'front') => void;
  setIsDraggingComponent: (isDragging: boolean) => void;
  setIsGizmoHovered: (hovered: boolean) => void;
  setIsShiftPressed: (isShift: boolean) => void;
  toggleCatalog: () => void;
  setCatalogOpen: (isOpen: boolean) => void;
  
  addComponent: (type: WorkbenchComponent['type'], initialPosition?: [number, number, number]) => void;
  removeComponent: (id: string) => void;
  removeSelectedComponents: () => void;
  updateComponentPosition: (id: string, position: [number, number, number]) => void;
  moveComponentsDelta: (deltaX: number, deltaZ: number) => void;
  elevateSelectedComponents: (deltaY: number) => void;
  setSelectedComponentElevation: (elevationY: number) => void;
  updateComponentRotation: (id: string, rotation: [number, number, number]) => void;
  rotateSelectedComponent: (deltaAngle?: number) => void;
  rotateSelectedComponentAxis: (axis: 'x' | 'y' | 'z', deltaAngle: number) => void;
  setSelectedComponentAxisAngle: (axis: 'x' | 'y' | 'z', angleRad: number) => void;
  resetSelectedComponentRotation: () => void;
  resetLayout: () => void;

  // Wires
  wires: WireConnection[];
  activeDraft: WireDraft | null;
  activeColor: string;
  wireSag: number;
  wireRoutingMode: 'orthogonal' | 'curved';
  setActiveColor: (color: string) => void;
  setWireSag: (sag: number) => void;
  setWireRoutingMode: (mode: 'orthogonal' | 'curved') => void;
  startWireDraft: (componentId: string, pinId: string) => void;
  completeWireDraft: (componentId: string, pinId: string) => void;
  cancelWireDraft: () => void;
  removeWire: (id: string) => void;
  clearAllWires: () => void;
  loadReferenceWiring: () => void;

  // Circuit Health & Electrical Validation
  circuitHealth: CircuitHealthReport;
  recomputeCircuitHealth: () => void;
  isCircuitHealthModalOpen: boolean;
  setCircuitHealthModalOpen: (open: boolean) => void;
  isSchematicModalOpen: boolean;
  setSchematicModalOpen: (open: boolean) => void;
  isJsonMonitorOpen: boolean;
  setJsonMonitorOpen: (open: boolean) => void;

  // Control Modes & Canonical Actuator Synchronization
  controlMode: 'auto' | 'manual' | 'fault_injection';
  setControlMode: (mode: 'auto' | 'manual' | 'fault_injection') => void;
  setActuatorState: (actuator: 'pump' | 'valve' | 'fan', active: boolean) => void;

  // Telemetry
  telemetry: LiveTelemetry;
  setTelemetry: (partial: Partial<LiveTelemetry>) => void;
  togglePump: () => void;
  toggleValve: () => void;
  toggleFan: () => void;
  isSimulating: boolean;
  toggleSimulation: () => void;

  // ESP32 Virtual MCU Runtime & Serial
  mcuState: MCUState;
  serialLogs: SerialLogEntry[];
  isResettingMCU: boolean;
  isSerialMonitorOpen: boolean;
  simulationTickCount: number;
  rebootMCU: () => void;
  sendSerialCommand: (cmd: string) => void;
  clearSerialLogs: () => void;
  tickMCU: () => void;
  setSerialMonitorOpen: (open: boolean) => void;

  // Real Undo / Redo History Stack
  history: { components: WorkbenchComponent[]; wires: WireConnection[] }[];
  historyIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;

  // Project Persistence & Safety
  saveProject: () => void;
  exportProjectJson: () => string;
  importProjectJson: (json: string) => boolean;
  destructiveConfirmation: DestructiveConfirmation | null;
  setDestructiveConfirmation: (conf: DestructiveConfirmation | null) => void;
}

// Initial hydration from LocalStorage if available
const savedProject = loadSavedProject();
const initialComps = savedProject ? savedProject.components : INITIAL_COMPONENTS;
const initialWires = savedProject ? savedProject.wires : SCADA_REFERENCE_WIRES;
const initialRoutingMode = savedProject?.wireRoutingMode ?? 'orthogonal';
const initialCircuitHealth = validateCircuitGraph(initialComps, initialWires);

export const useWorkbenchStore = create<WorkbenchStore>((set, get) => {
  // Helper to record history snapshot and auto-save
  const recordHistoryAndPersist = (
    components: WorkbenchComponent[],
    wires: WireConnection[]
  ) => {
    const { history, historyIndex, wireRoutingMode } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({
      components: JSON.parse(JSON.stringify(components)),
      wires: JSON.parse(JSON.stringify(wires)),
    });
    if (newHistory.length > 30) newHistory.shift();
    const newIdx = newHistory.length - 1;

    persistProject(components, wires, wireRoutingMode);
    const health = validateCircuitGraph(components, wires);

    return {
      history: newHistory,
      historyIndex: newIdx,
      canUndo: newIdx > 0,
      canRedo: false,
      circuitHealth: health,
    };
  };

  return {
    components: initialComps,
    selectedComponentIds: [],
    selectedComponentId: null,
    transformMode: 'translate',
    cameraView: 'iso',
    isDraggingComponent: false,
    isGizmoHovered: false,
    isCatalogOpen: false, // Default to clean, uncrowded desktop view
    isShiftPressed: false,

    setSelectedComponentIds: (ids) =>
      set({
        selectedComponentIds: ids,
        selectedComponentId: ids.length > 0 ? ids[0] : null,
      }),

    setSelectedComponentId: (id) =>
      set({
        selectedComponentIds: id ? [id] : [],
        selectedComponentId: id,
      }),

    toggleComponentSelection: (id, isMulti = false) =>
      set((state) => {
        if (!isMulti) {
          return {
            selectedComponentIds: [id],
            selectedComponentId: id,
          };
        }
        const exists = state.selectedComponentIds.includes(id);
        const newIds = exists
          ? state.selectedComponentIds.filter((item) => item !== id)
          : [...state.selectedComponentIds, id];
        return {
          selectedComponentIds: newIds,
          selectedComponentId: newIds.length > 0 ? newIds[0] : null,
        };
      }),

    setTransformMode: (mode) => set({ transformMode: mode }),
    setCameraView: (view) => set({ cameraView: view }),
    setIsDraggingComponent: (isDragging) =>
      set((state) => {
        if (!isDragging && state.isDraggingComponent) {
          const histUpdate = recordHistoryAndPersist(state.components, state.wires);
          return { isDraggingComponent: false, ...histUpdate };
        }
        return { isDraggingComponent: isDragging };
      }),
    setIsGizmoHovered: (hovered) => set({ isGizmoHovered: hovered }),
    setIsShiftPressed: (isShift) => set({ isShiftPressed: isShift }),
    toggleCatalog: () => set((state) => ({ isCatalogOpen: !state.isCatalogOpen })),
    setCatalogOpen: (isOpen) => set({ isCatalogOpen: isOpen }),

    addComponent: (type, initialPosition) =>
      set((state) => {
        const template = COMPONENT_CATALOG.find((c) => c.type === type);
        if (!template) return state;

        const newId = `${type}_${Date.now().toString(36)}`;
        const spawnX = initialPosition ? initialPosition[0] : (Math.random() - 0.5) * 1.5;
        const spawnZ = initialPosition ? initialPosition[2] : (Math.random() - 0.5) * 1.5;

        const newComp: WorkbenchComponent = {
          id: newId,
          ...template,
          position: [spawnX, 0.005, spawnZ],
          rotation: [0, 0, 0],
        };

        const updatedComps = [...state.components, newComp];
        const histUpdate = recordHistoryAndPersist(updatedComps, state.wires);

        return {
          components: updatedComps,
          selectedComponentIds: [newId],
          selectedComponentId: newId,
          ...histUpdate,
        };
      }),

    removeComponent: (id) =>
      set((state) => {
        const remainingComps = state.components.filter((c) => c.id !== id);
        const remainingWires = state.wires.filter(
          (w) => w.fromComponentId !== id && w.toComponentId !== id
        );
        const histUpdate = recordHistoryAndPersist(remainingComps, remainingWires);

        return {
          components: remainingComps,
          wires: remainingWires,
          selectedComponentIds: state.selectedComponentIds.filter((cid) => cid !== id),
          selectedComponentId: state.selectedComponentId === id ? null : state.selectedComponentId,
          ...histUpdate,
        };
      }),

    removeSelectedComponents: () =>
      set((state) => {
        const toRemove = state.selectedComponentIds;
        if (toRemove.length === 0) return state;

        const remainingComps = state.components.filter((c) => !toRemove.includes(c.id));
        const remainingWires = state.wires.filter(
          (w) => !toRemove.includes(w.fromComponentId) && !toRemove.includes(w.toComponentId)
        );
        const histUpdate = recordHistoryAndPersist(remainingComps, remainingWires);

        return {
          components: remainingComps,
          wires: remainingWires,
          selectedComponentIds: [],
          selectedComponentId: null,
          ...histUpdate,
        };
      }),

    updateComponentPosition: (id, position) =>
      set((state) => {
        const updatedComps = state.components.map((c) =>
          c.id === id ? { ...c, position } : c
        );
        persistProject(updatedComps, state.wires);
        return { components: updatedComps };
      }),

    moveComponentsDelta: (deltaX, deltaZ) =>
      set((state) => {
        const selected = state.selectedComponentIds;
        if (selected.length === 0) return state;

        const updatedComps = state.components.map((c) => {
          if (!selected.includes(c.id)) return c;
          const newX = Math.max(-2.5, Math.min(2.5, c.position[0] + deltaX));
          const newZ = Math.max(-1.5, Math.min(1.5, c.position[2] + deltaZ));
          return {
            ...c,
            position: [newX, c.position[1], newZ] as [number, number, number],
          };
        });
        persistProject(updatedComps, state.wires);
        return { components: updatedComps };
      }),

    elevateSelectedComponents: (deltaY) =>
      set((state) => {
        const selected = state.selectedComponentIds;
        if (selected.length === 0) return state;

        const updatedComps = state.components.map((c) => {
          if (!selected.includes(c.id)) return c;
          const newY = Math.max(0.005, Math.min(0.8, c.position[1] + deltaY));
          return {
            ...c,
            position: [c.position[0], parseFloat(newY.toFixed(4)), c.position[2]] as [number, number, number],
          };
        });
        const histUpdate = recordHistoryAndPersist(updatedComps, state.wires);
        return { components: updatedComps, ...histUpdate };
      }),

    setSelectedComponentElevation: (elevationY) =>
      set((state) => {
        const selected = state.selectedComponentIds;
        if (selected.length === 0) return state;

        const updatedComps = state.components.map((c) => {
          if (!selected.includes(c.id)) return c;
          const newY = Math.max(0.005, Math.min(0.8, elevationY));
          return {
            ...c,
            position: [c.position[0], parseFloat(newY.toFixed(4)), c.position[2]] as [number, number, number],
          };
        });
        const histUpdate = recordHistoryAndPersist(updatedComps, state.wires);
        return { components: updatedComps, ...histUpdate };
      }),

    updateComponentRotation: (id, rotation) =>
      set((state) => {
        const updatedComps = state.components.map((c) =>
          c.id === id ? { ...c, rotation } : c
        );
        persistProject(updatedComps, state.wires);
        return { components: updatedComps };
      }),

    rotateSelectedComponent: (deltaAngle = Math.PI / 2) =>
      set((state) => {
        const selected = state.selectedComponentIds;
        if (selected.length === 0) return state;

        const updatedComps = state.components.map((c) => {
          if (!selected.includes(c.id)) return c;
          const [rx, ry, rz] = c.rotation;
          return {
            ...c,
            rotation: [rx, (ry + deltaAngle) % (Math.PI * 2), rz] as [number, number, number],
          };
        });
        const histUpdate = recordHistoryAndPersist(updatedComps, state.wires);
        return { components: updatedComps, ...histUpdate };
      }),

    rotateSelectedComponentAxis: (axis, deltaAngle) =>
      set((state) => {
        const selected = state.selectedComponentIds;
        if (selected.length === 0) return state;

        const updatedComps = state.components.map((c) => {
          if (!selected.includes(c.id)) return c;
          const [rx, ry, rz] = c.rotation;
          return {
            ...c,
            rotation: [
              axis === 'x' ? (rx + deltaAngle) % (Math.PI * 2) : rx,
              axis === 'y' ? (ry + deltaAngle) % (Math.PI * 2) : ry,
              axis === 'z' ? (rz + deltaAngle) % (Math.PI * 2) : rz,
            ] as [number, number, number],
          };
        });
        const histUpdate = recordHistoryAndPersist(updatedComps, state.wires);
        return { components: updatedComps, ...histUpdate };
      }),

    setSelectedComponentAxisAngle: (axis, angleRad) =>
      set((state) => {
        const selected = state.selectedComponentIds;
        if (selected.length === 0) return state;

        const updatedComps = state.components.map((c) => {
          if (!selected.includes(c.id)) return c;
          const [rx, ry, rz] = c.rotation;
          return {
            ...c,
            rotation: [
              axis === 'x' ? angleRad : rx,
              axis === 'y' ? angleRad : ry,
              axis === 'z' ? angleRad : rz,
            ] as [number, number, number],
          };
        });
        const histUpdate = recordHistoryAndPersist(updatedComps, state.wires);
        return { components: updatedComps, ...histUpdate };
      }),

    resetSelectedComponentRotation: () =>
      set((state) => {
        const selected = state.selectedComponentIds;
        if (selected.length === 0) return state;

        const updatedComps = state.components.map((c) =>
          selected.includes(c.id) ? { ...c, rotation: [0, 0, 0] as [number, number, number] } : c
        );
        const histUpdate = recordHistoryAndPersist(updatedComps, state.wires);
        return { components: updatedComps, ...histUpdate };
      }),

    resetLayout: () => {
      const histUpdate = recordHistoryAndPersist(INITIAL_COMPONENTS, SCADA_REFERENCE_WIRES);
      set({
        components: INITIAL_COMPONENTS,
        wires: SCADA_REFERENCE_WIRES,
        selectedComponentIds: [],
        selectedComponentId: null,
        cameraView: 'iso',
        telemetry: INITIAL_TELEMETRY,
        activeDraft: null,
        ...histUpdate,
      });
    },

    // Wires
    wires: initialWires,
    activeDraft: null,
    activeColor: '#ef4444',
    wireSag: 0.35,
    wireRoutingMode: initialRoutingMode,

    setActiveColor: (color) => set({ activeColor: color }),
    setWireSag: (sag) => set({ wireSag: sag }),
    setWireRoutingMode: (mode) => {
      persistProject(get().components, get().wires, mode);
      set({ wireRoutingMode: mode });
    },

    startWireDraft: (componentId, pinId) =>
      set((state) => ({
        activeDraft: {
          fromComponentId: componentId,
          fromPinId: pinId,
          currentColor: state.activeColor,
        },
      })),

    completeWireDraft: (componentId, pinId) =>
      set((state) => {
        if (!state.activeDraft) return state;
        if (
          state.activeDraft.fromComponentId === componentId &&
          state.activeDraft.fromPinId === pinId
        ) {
          return { activeDraft: null };
        }

        const newWire: WireConnection = {
          id: `wire_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          fromComponentId: state.activeDraft.fromComponentId,
          fromPinId: state.activeDraft.fromPinId,
          toComponentId: componentId,
          toPinId: pinId,
          color: state.activeColor,
          sag: state.wireSag,
        };

        const updatedWires = [...state.wires, newWire];
        const histUpdate = recordHistoryAndPersist(state.components, updatedWires);

        return {
          wires: updatedWires,
          activeDraft: null,
          ...histUpdate,
        };
      }),

    cancelWireDraft: () => set({ activeDraft: null }),

    removeWire: (id) =>
      set((state) => {
        const remainingWires = state.wires.filter((w) => w.id !== id);
        const histUpdate = recordHistoryAndPersist(state.components, remainingWires);
        return { wires: remainingWires, ...histUpdate };
      }),

    clearAllWires: () =>
      set((state) => {
        const histUpdate = recordHistoryAndPersist(state.components, []);
        return { wires: [], ...histUpdate };
      }),

    loadReferenceWiring: () =>
      set((state) => {
        const histUpdate = recordHistoryAndPersist(state.components, SCADA_REFERENCE_WIRES);
        return { wires: SCADA_REFERENCE_WIRES, ...histUpdate };
      }),

    // Circuit Health
    circuitHealth: initialCircuitHealth,
    recomputeCircuitHealth: () =>
      set((state) => ({
        circuitHealth: validateCircuitGraph(state.components, state.wires),
      })),
    isCircuitHealthModalOpen: false,
    setCircuitHealthModalOpen: (open) => set({ isCircuitHealthModalOpen: open }),
    isSchematicModalOpen: false,
    setSchematicModalOpen: (open) => set({ isSchematicModalOpen: open }),
    isJsonMonitorOpen: false,
    setJsonMonitorOpen: (open) => set({ isJsonMonitorOpen: open }),

    // Control Modes & Canonical Actuator Synchronization
    controlMode: 'auto',
    setControlMode: (mode) => set({ controlMode: mode }),

    setActuatorState: (actuator, active) =>
      set((state) => {
        const nextTelemetry = {
          ...state.telemetry,
          pump_active: actuator === 'pump' ? active : state.telemetry.pump_active,
          valve_open: actuator === 'valve' ? active : state.telemetry.valve_open,
          fan_active: actuator === 'fan' ? active : state.telemetry.fan_active,
        };
        const nextMcu = {
          ...state.mcuState,
          gpioStates: {
            ...state.mcuState.gpioStates,
            gpio26: nextTelemetry.pump_active,
            gpio27: nextTelemetry.valve_open,
            gpio14: nextTelemetry.fan_active,
          },
          modbusCoils: {
            ...state.mcuState.modbusCoils,
            1: nextTelemetry.pump_active,
            2: nextTelemetry.valve_open,
            3: nextTelemetry.fan_active,
          },
        };
        return { telemetry: nextTelemetry, mcuState: nextMcu };
      }),

    // Telemetry
    telemetry: INITIAL_TELEMETRY,

    setTelemetry: (partial) =>
      set((state) => {
        const updated = { ...state.telemetry, ...partial };
        // Strict boundary clamps
        updated.tank_level = Math.min(100.0, Math.max(0.0, parseFloat(updated.tank_level.toFixed(1))));
        updated.temperature = Math.min(100.0, Math.max(0.0, parseFloat(updated.temperature.toFixed(1))));
        updated.gas_ppm = Math.min(1000.0, Math.max(0.0, parseFloat(updated.gas_ppm.toFixed(1))));
        updated.current_draw = Math.min(5.00, Math.max(0.0, parseFloat(updated.current_draw.toFixed(2))));

        let status_class: 0 | 1 | 2 = 0;
        if (
          updated.gas_ppm > 250 ||
          updated.temperature > 70 ||
          updated.current_draw > 3.8 ||
          updated.tank_level > 92 ||
          updated.tank_level < 8
        ) {
          status_class = 2;
        } else if (
          updated.gas_ppm > 80 ||
          updated.temperature > 45 ||
          updated.current_draw > 2.3 ||
          updated.tank_level > 80 ||
          updated.tank_level < 25
        ) {
          status_class = 1;
        }

        // Atomically update Modbus Holding Registers
        const nextMcu = {
          ...state.mcuState,
          modbusRegisters: {
            ...state.mcuState.modbusRegisters,
            40001: Math.round(updated.tank_level * 10),
            40002: Math.round(updated.temperature * 10),
            40003: Math.round(updated.gas_ppm),
            40004: Math.round(updated.current_draw * 100),
          },
        };

        return { telemetry: { ...updated, status_class }, mcuState: nextMcu };
      }),

    togglePump: () => {
      const current = get().telemetry.pump_active;
      get().setActuatorState('pump', !current);
    },

    toggleValve: () => {
      const current = get().telemetry.valve_open;
      get().setActuatorState('valve', !current);
    },

    toggleFan: () => {
      const current = get().telemetry.fan_active;
      get().setActuatorState('fan', !current);
    },

    isSimulating: true,
    toggleSimulation: () =>
      set((state) => {
        const nextSim = !state.isSimulating;
        return {
          isSimulating: nextSim,
          serialLogs:
            nextSim && state.serialLogs.length === 0 ? generateBootLogs() : state.serialLogs,
        };
      }),

    // ESP32 Virtual MCU Runtime & Serial
    mcuState: getInitialMCUState(),
    serialLogs: generateBootLogs(),
    isResettingMCU: false,
    isSerialMonitorOpen: false,
    simulationTickCount: 0,

    setSerialMonitorOpen: (open) => set({ isSerialMonitorOpen: open }),
    clearSerialLogs: () => set({ serialLogs: [] }),

    rebootMCU: () => {
      set({ isResettingMCU: true });
      setTimeout(() => {
        set({
          isResettingMCU: false,
          mcuState: getInitialMCUState(),
          serialLogs: generateBootLogs(),
          simulationTickCount: 0,
        });
      }, 280);
    },

    sendSerialCommand: (rawCmd: string) =>
      set((state) => {
        const entries = executeSerialCLICommand(rawCmd, state.mcuState, state.telemetry, {
          reboot: () => {
            setTimeout(() => {
              useWorkbenchStore.getState().rebootMCU();
            }, 50);
          },
          setActuator: (actuator, active) => {
            useWorkbenchStore.getState().setActuatorState(actuator, active);
          },
          clearLogs: () => {
            useWorkbenchStore.getState().clearSerialLogs();
          },
        });

        if (entries.length === 0) return state;
        return {
          serialLogs: [...state.serialLogs, ...entries].slice(-250),
        };
      }),

    tickMCU: () =>
      set((state) => {
        const res = executeMCUControlStep(
          state.telemetry,
          state.mcuState,
          state.simulationTickCount,
          state.circuitHealth,
          state.controlMode
        );
        const updatedLogs =
          res.newLogs.length > 0 ? [...state.serialLogs, ...res.newLogs].slice(-250) : state.serialLogs;
        return {
          telemetry: res.updatedTelemetry,
          mcuState: res.updatedMCUState,
          serialLogs: updatedLogs,
          simulationTickCount: state.simulationTickCount + 1,
        };
      }),

    // Real Undo / Redo History Stack
    history: [
      {
        components: JSON.parse(JSON.stringify(initialComps)),
        wires: JSON.parse(JSON.stringify(initialWires)),
      },
    ],
    historyIndex: 0,
    canUndo: false,
    canRedo: false,

    undo: () =>
      set((state) => {
        if (state.historyIndex <= 0) return state;
        const newIdx = state.historyIndex - 1;
        const snapshot = state.history[newIdx];
        const health = validateCircuitGraph(snapshot.components, snapshot.wires);
        persistProject(snapshot.components, snapshot.wires);

        return {
          components: JSON.parse(JSON.stringify(snapshot.components)),
          wires: JSON.parse(JSON.stringify(snapshot.wires)),
          historyIndex: newIdx,
          canUndo: newIdx > 0,
          canRedo: true,
          circuitHealth: health,
          selectedComponentIds: [],
          selectedComponentId: null,
        };
      }),

    redo: () =>
      set((state) => {
        if (state.historyIndex >= state.history.length - 1) return state;
        const newIdx = state.historyIndex + 1;
        const snapshot = state.history[newIdx];
        const health = validateCircuitGraph(snapshot.components, snapshot.wires);
        persistProject(snapshot.components, snapshot.wires);

        return {
          components: JSON.parse(JSON.stringify(snapshot.components)),
          wires: JSON.parse(JSON.stringify(snapshot.wires)),
          historyIndex: newIdx,
          canUndo: true,
          canRedo: newIdx < state.history.length - 1,
          circuitHealth: health,
          selectedComponentIds: [],
          selectedComponentId: null,
        };
      }),

    // Project Persistence & Safety
    saveProject: () => {
      const state = get();
      persistProject(state.components, state.wires);
    },

    resetProjectToDefault: () => {
      localStorage.removeItem(STORAGE_KEY);
      get().resetLayout();
    },

    exportProjectJson: () => {
      const state = get();
      return JSON.stringify(
        {
          version: 2,
          timestamp: Date.now(),
          components: state.components,
          wires: state.wires,
        },
        null,
        2
      );
    },

    importProjectJson: (jsonStr: string) => {
      try {
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed.components) && Array.isArray(parsed.wires)) {
          const histUpdate = recordHistoryAndPersist(parsed.components, parsed.wires);
          set({
            components: parsed.components,
            wires: parsed.wires,
            selectedComponentIds: [],
            selectedComponentId: null,
            ...histUpdate,
          });
          return true;
        }
      } catch (err) {
        console.warn('Import failed:', err);
      }
      return false;
    },

    destructiveConfirmation: null,
    setDestructiveConfirmation: (conf) => set({ destructiveConfirmation: conf }),
  };
});

if (typeof window !== 'undefined') {
  (window as any).__WORKBENCH_STORE__ = useWorkbenchStore;
}
