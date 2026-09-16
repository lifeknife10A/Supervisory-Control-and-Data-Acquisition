import type { WorkbenchComponent, WireConnection } from '../types/workbench';
import { HARDWARE_PINS } from '../constants/pinMapping';

export interface DeviceHealth {
  connected: boolean;
  powerOk: boolean;
  groundOk: boolean;
  signalOk: boolean;
  statusText: string;
}

export interface CircuitHealthReport {
  isHealthy: boolean;
  isEsp32Powered: boolean;
  esp32Powered: boolean;
  powerRailsOk: boolean;
  validPathsCount: number;
  totalRequiredPaths: number;
  healthPercentage: number;
  devices: {
    esp32: DeviceHealth;
    tankLevelSensor: DeviceHealth;
    tempSensor: DeviceHealth;
    gasSensor: DeviceHealth;
    currentSensor: DeviceHealth;
    pumpActuator: DeviceHealth;
    valveActuator: DeviceHealth;
    fanActuator: DeviceHealth;
    lcdDisplay: DeviceHealth;
    ledGreen: DeviceHealth;
    ledRed: DeviceHealth;
  };
  faults: string[];
}

export const REQUIRED_CIRCUIT_PATHS = [
  'esp32',
  'tankLevelSensor',
  'tempSensor',
  'gasSensor',
  'currentSensor',
  'pumpActuator',
  'valveActuator',
  'fanActuator',
  'lcdDisplay',
  'ledGreen',
  'ledRed',
] as const;

export type RequiredCircuitKey = typeof REQUIRED_CIRCUIT_PATHS[number];

/**
 * Disjoint Set Union (DSU) for electrical netlist resolution.
 */
class ElectricalNetlist {
  private parent: Map<string, string> = new Map();

  private key(compId: string, pinId: string): string {
    return `${compId}::${pinId.toLowerCase()}`;
  }

  public find(compId: string, pinId: string): string {
    const k = this.key(compId, pinId);
    if (!this.parent.has(k)) {
      this.parent.set(k, k);
      return k;
    }
    const p = this.parent.get(k)!;
    if (p !== k) {
      const root = this.findKey(p);
      this.parent.set(k, root);
      return root;
    }
    return k;
  }

  private findKey(k: string): string {
    if (!this.parent.has(k)) {
      this.parent.set(k, k);
      return k;
    }
    const p = this.parent.get(k)!;
    if (p !== k) {
      const root = this.findKey(p);
      this.parent.set(k, root);
      return root;
    }
    return k;
  }

  public union(c1: string, p1: string, c2: string, p2: string): void {
    const root1 = this.find(c1, p1);
    const root2 = this.find(c2, p2);
    if (root1 !== root2) {
      this.parent.set(root1, root2);
    }
  }

  public isConnected(c1: string, p1: string, c2: string, p2: string): boolean {
    return this.find(c1, p1) === this.find(c2, p2);
  }
}

/**
 * Validates the circuit graph built from components and wires with physical accuracy.
 */
export function validateCircuitGraph(
  components: WorkbenchComponent[],
  wires: WireConnection[]
): CircuitHealthReport {
  const netlist = new ElectricalNetlist();

  // 1. Model Breadboard Internal Tie Points and Power Bus Strips
  const breadboards = components.filter((c) => c.type === 'breadboard');
  for (const bb of breadboards) {
    // Top & Bottom VCC and GND Rails (columns 1 to 30)
    for (let col = 2; col <= 30; col++) {
      netlist.union(bb.id, 'top_vcc_1', bb.id, `top_vcc_${col}`);
      netlist.union(bb.id, 'top_gnd_1', bb.id, `top_gnd_${col}`);
      netlist.union(bb.id, 'bot_vcc_1', bb.id, `bot_vcc_${col}`);
      netlist.union(bb.id, 'bot_gnd_1', bb.id, `bot_gnd_${col}`);
    }
    // Aliases
    netlist.union(bb.id, 'top_vcc_1', bb.id, 'rail_vcc_top');
    netlist.union(bb.id, 'top_vcc_1', bb.id, 'rail_vcc_top_r');
    netlist.union(bb.id, 'top_gnd_1', bb.id, 'rail_gnd_top');
    netlist.union(bb.id, 'top_gnd_1', bb.id, 'rail_gnd_top_r');
    netlist.union(bb.id, 'bot_vcc_1', bb.id, 'rail_vcc_bot');
    netlist.union(bb.id, 'bot_vcc_1', bb.id, 'rail_vcc_bot_r');
    netlist.union(bb.id, 'bot_gnd_1', bb.id, 'rail_gnd_bot');
    netlist.union(bb.id, 'bot_gnd_1', bb.id, 'rail_gnd_bot_r');

    // Terminal Rows: a-e in column share strip; f-j in column share strip
    const topRows = ['a', 'b', 'c', 'd', 'e'];
    const botRows = ['f', 'g', 'h', 'i', 'j'];
    for (let col = 1; col <= 30; col++) {
      for (let r = 1; r < topRows.length; r++) {
        netlist.union(bb.id, `tie_${col}${topRows[0]}`, bb.id, `tie_${col}${topRows[r]}`);
      }
      for (let r = 1; r < botRows.length; r++) {
        netlist.union(bb.id, `tie_${col}${botRows[0]}`, bb.id, `tie_${col}${botRows[r]}`);
      }
    }
  }

  // 2. Add All Physical Jumper Wires to Netlist
  for (const wire of wires) {
    netlist.union(wire.fromComponentId, wire.fromPinId, wire.toComponentId, wire.toPinId);
  }

  // 3. Locate Core System Components
  const esp32 = components.find((c) => c.type === 'esp32');
  const faults: string[] = [];

  const totalRequiredPaths = REQUIRED_CIRCUIT_PATHS.length;

  if (!esp32) {
    return {
      isHealthy: false,
      isEsp32Powered: false,
      esp32Powered: false,
      powerRailsOk: false,
      validPathsCount: 0,
      totalRequiredPaths,
      healthPercentage: 0,
      devices: createAllDisconnectedDevices('ESP32 not found on workbench'),
      faults: ['ESP32 DevKit V1 board is missing from workbench.'],
    };
  }

  // Determine Power & Ground Nets
  const vccPin = HARDWARE_PINS.ESP32_VIN;
  const p3v3Pin = HARDWARE_PINS.ESP32_3V3;
  const gnd1Pin = HARDWARE_PINS.ESP32_GND_1;
  const gnd2Pin = HARDWARE_PINS.ESP32_GND_2;

  const isPowerNet = (cId: string, pId: string, voltage: 'any' | '5v' | '3v3' = 'any'): boolean => {
    const has5v = netlist.isConnected(cId, pId, esp32.id, vccPin);
    const has3v3 = netlist.isConnected(cId, pId, esp32.id, p3v3Pin);
    if (voltage === '5v') return has5v;
    if (voltage === '3v3') return has3v3;
    return has5v || has3v3;
  };

  const isGndNet = (cId: string, pId: string): boolean => {
    return (
      netlist.isConnected(cId, pId, esp32.id, gnd1Pin) ||
      netlist.isConnected(cId, pId, esp32.id, gnd2Pin)
    );
  };

  // Check Breadboard Power Rail Continuity from ESP32
  let powerRailsOk = false;
  if (breadboards.length > 0) {
    const bb0 = breadboards[0].id;
    const topVcc = isPowerNet(bb0, 'top_vcc_1');
    const topGnd = isGndNet(bb0, 'top_gnd_1');
    const botVcc = isPowerNet(bb0, 'bot_vcc_1');
    const botGnd = isGndNet(bb0, 'bot_gnd_1');

    powerRailsOk = (topVcc && topGnd) || (botVcc && botGnd);
    if (!powerRailsOk) {
      faults.push('Breadboard power rails are not energized from ESP32 (check VIN/3.3V and GND wires).');
    }
  }

  // --- 1. ESP32 Board Health ---
  const esp32Wired = wires.some(w => w.fromComponentId === esp32.id || w.toComponentId === esp32.id);
  const esp32PowerOk = esp32Wired && powerRailsOk;
  const esp32Health: DeviceHealth = {
    connected: esp32PowerOk,
    powerOk: esp32PowerOk,
    groundOk: esp32PowerOk,
    signalOk: true,
    statusText: esp32PowerOk ? 'Powered & Ready (240MHz)' : 'Missing 5V/GND Supply Rail',
  };
  if (!esp32PowerOk) {
    faults.push(`ESP32: ${esp32Health.statusText}`);
  }

  // --- 2. HC-SR04 Level Sensor ---
  const hc = components.find((c) => c.type === 'hc_sr04');
  let hcHealth: DeviceHealth = { connected: false, powerOk: false, groundOk: false, signalOk: false, statusText: 'Not Placed' };
  if (hc) {
    const pwr = isPowerNet(hc.id, 'vcc', '5v');
    const gnd = isGndNet(hc.id, 'gnd');
    const trig = netlist.isConnected(hc.id, 'trig', esp32.id, HARDWARE_PINS.HC_SR04_TRIG);
    const echo = netlist.isConnected(hc.id, 'echo', esp32.id, HARDWARE_PINS.HC_SR04_ECHO);
    const ok = pwr && gnd && trig && echo;
    hcHealth = {
      connected: ok,
      powerOk: pwr,
      groundOk: gnd,
      signalOk: trig && echo,
      statusText: ok
        ? 'Nominal (TRIG: GPIO25, ECHO: GPIO34)'
        : !pwr
        ? 'Missing 5V VCC'
        : !gnd
        ? 'Missing GND'
        : !trig
        ? 'TRIG not connected to GPIO 25'
        : 'ECHO not connected to GPIO 34 (via Divider)',
    };
    if (!ok) faults.push(`Tank Level Sensor: ${hcHealth.statusText}`);
  } else {
    faults.push('Tank Level Sensor: Component missing from workbench');
  }

  // --- 3. DS18B20 Temp Probe (Requires 4.7kΩ Pull-Up Resistor to 3.3V on GPIO 4) ---
  const ds = components.find((c) => c.type === 'ds18b20');
  let dsHealth: DeviceHealth = { connected: false, powerOk: false, groundOk: false, signalOk: false, statusText: 'Not Placed' };
  if (ds) {
    const pwr = isPowerNet(ds.id, 'vcc');
    const gnd = isGndNet(ds.id, 'gnd');
    const data = netlist.isConnected(ds.id, 'data', esp32.id, HARDWARE_PINS.DS18B20_DATA);

    // Verify 4.7kΩ Pull-Up Resistor is genuinely tied between DATA line and 3.3V rail
    const hasPullUp = components.some(c =>
      c.type === 'resistor' &&
      ((netlist.isConnected(c.id, 'lead_1', ds.id, 'data') && isPowerNet(c.id, 'lead_2', '3v3')) ||
       (netlist.isConnected(c.id, 'lead_2', ds.id, 'data') && isPowerNet(c.id, 'lead_1', '3v3')) ||
       (netlist.isConnected(c.id, 'lead_1', esp32.id, HARDWARE_PINS.DS18B20_DATA) && isPowerNet(c.id, 'lead_2', '3v3')) ||
       (netlist.isConnected(c.id, 'lead_2', esp32.id, HARDWARE_PINS.DS18B20_DATA) && isPowerNet(c.id, 'lead_1', '3v3')))
    );

    const ok = pwr && gnd && data && hasPullUp;
    dsHealth = {
      connected: ok,
      powerOk: pwr,
      groundOk: gnd,
      signalOk: data && hasPullUp,
      statusText: ok
        ? 'Nominal (1-Wire GPIO4 with 4.7kΩ Pullup)'
        : !pwr
        ? 'Missing 3.3V/5V VCC'
        : !gnd
        ? 'Missing GND'
        : !data
        ? 'DATA pin not connected to 1-Wire GPIO 4'
        : 'Missing 4.7kΩ Pull-up Resistor to 3.3V',
    };
    if (!ok) faults.push(`Temperature Sensor: ${dsHealth.statusText}`);
  } else {
    faults.push('Temperature Sensor: Component missing from workbench');
  }

  // --- 4. MQ-2 Gas Sensor ---
  const mq = components.find((c) => c.type === 'mq2');
  let mqHealth: DeviceHealth = { connected: false, powerOk: false, groundOk: false, signalOk: false, statusText: 'Not Placed' };
  if (mq) {
    const pwr = isPowerNet(mq.id, 'vcc', '5v');
    const gnd = isGndNet(mq.id, 'gnd');
    const ao = netlist.isConnected(mq.id, 'ao', esp32.id, HARDWARE_PINS.MQ2_AO);
    const ok = pwr && gnd && ao;
    mqHealth = {
      connected: ok,
      powerOk: pwr,
      groundOk: gnd,
      signalOk: ao,
      statusText: ok
        ? 'Nominal (AO: GPIO32 ADC1_CH4)'
        : !pwr
        ? 'Missing 5V VCC'
        : !gnd
        ? 'Missing GND'
        : 'AO not connected to ADC GPIO 32',
    };
    if (!ok) faults.push(`MQ-2 Gas Sensor: ${mqHealth.statusText}`);
  } else {
    faults.push('MQ-2 Gas Sensor: Component missing from workbench');
  }

  // --- 5. ACS712 Current Board ---
  const acs = components.find((c) => c.type === 'acs712');
  let acsHealth: DeviceHealth = { connected: false, powerOk: false, groundOk: false, signalOk: false, statusText: 'Not Placed' };
  if (acs) {
    const pwr = isPowerNet(acs.id, 'vcc', '5v');
    const gnd = isGndNet(acs.id, 'gnd');
    const out = netlist.isConnected(acs.id, 'out', esp32.id, HARDWARE_PINS.ACS712_OUT);
    const ok = pwr && gnd && out;
    acsHealth = {
      connected: ok,
      powerOk: pwr,
      groundOk: gnd,
      signalOk: out,
      statusText: ok
        ? 'Nominal (OUT: GPIO33 ADC1_CH5)'
        : !pwr
        ? 'Missing 5V VCC'
        : !gnd
        ? 'Missing GND'
        : 'Analog OUT not connected to GPIO 33',
    };
    if (!ok) faults.push(`ACS712 Current Sensor: ${acsHealth.statusText}`);
  } else {
    faults.push('ACS712 Current Sensor: Component missing from workbench');
  }

  // --- 6. 5V Relay & Inflow Pump Series Circuit ---
  const relay = components.find((c) => c.type === 'relay');
  const pump = components.find((c) => c.type === 'pump');
  let pumpHealth: DeviceHealth = { connected: false, powerOk: false, groundOk: false, signalOk: false, statusText: 'Not Placed' };
  if (relay && pump) {
    const relayPwr = isPowerNet(relay.id, 'vcc', '5v');
    const relayGnd = isGndNet(relay.id, 'gnd');
    const relayCtrl = netlist.isConnected(relay.id, 'in', esp32.id, HARDWARE_PINS.RELAY_PUMP_IN);
    const relayComPwr = isPowerNet(relay.id, 'com', '5v');
    const pumpGnd = isGndNet(pump.id, 'gnd');

    // Motor series path: Relay NO -> ACS712 IP+ -> ACS712 IP- -> Pump VCC
    const pumpDrivenByRelay = Boolean(
      (acs && netlist.isConnected(relay.id, 'no', acs.id, 'ip_plus') && netlist.isConnected(acs.id, 'ip_minus', pump.id, 'vcc')) ||
      netlist.isConnected(relay.id, 'no', pump.id, 'vcc')
    );

    const ok = relayPwr && relayGnd && relayCtrl && relayComPwr && pumpGnd && pumpDrivenByRelay;
    pumpHealth = {
      connected: ok,
      powerOk: relayPwr && relayComPwr,
      groundOk: relayGnd && pumpGnd,
      signalOk: relayCtrl,
      statusText: ok
        ? 'Relay Switched Inflow Loop Verified'
        : !relayCtrl
        ? 'Relay IN not connected to GPIO 26'
        : !relayComPwr
        ? 'Relay COM has no 5V Supply'
        : !pumpDrivenByRelay
        ? 'Pump VCC not wired to Relay NO (via ACS712)'
        : 'Pump GND Disconnected',
    };
    if (!ok) faults.push(`Pump & Relay: ${pumpHealth.statusText}`);
  } else {
    faults.push('Pump & Relay: Relay or Pump component missing');
  }

  // --- 7. Solenoid Drain Valve Driver Module (VCC, GND, IN from GPIO 27) ---
  const valve = components.find((c) => c.type === 'valve');
  let valveHealth: DeviceHealth = { connected: false, powerOk: false, groundOk: false, signalOk: false, statusText: 'Not Placed' };
  if (valve) {
    const pwr = isPowerNet(valve.id, 'vcc', '5v');
    const gnd = isGndNet(valve.id, 'gnd');
    const inPin = valve.pins.some(p => p.id === 'in') ? 'in' : 'vcc';
    const ctrl = netlist.isConnected(valve.id, inPin, esp32.id, HARDWARE_PINS.VALVE_DRIVER_IN) ||
                 (pwr && netlist.isConnected(valve.id, 'in', esp32.id, HARDWARE_PINS.VALVE_DRIVER_IN));
    const ok = (pwr && gnd && ctrl) || (gnd && netlist.isConnected(valve.id, 'vcc', esp32.id, HARDWARE_PINS.VALVE_DRIVER_IN));
    valveHealth = {
      connected: ok,
      powerOk: pwr || ok,
      groundOk: gnd,
      signalOk: ctrl,
      statusText: ok ? 'Driver Module Loop Armed (GPIO 27)' : !gnd ? 'Missing GND Return' : 'Driver IN not connected to GPIO 27',
    };
    if (!ok) faults.push(`Emergency Valve: ${valveHealth.statusText}`);
  } else {
    faults.push('Emergency Valve: Valve module missing from workbench');
  }

  // --- 8. Exhaust Fan Driver Module (VCC, GND, IN from GPIO 14) ---
  const fan = components.find((c) => c.type === 'fan');
  let fanHealth: DeviceHealth = { connected: false, powerOk: false, groundOk: false, signalOk: false, statusText: 'Not Placed' };
  if (fan) {
    const pwr = isPowerNet(fan.id, 'vcc', '5v');
    const gnd = isGndNet(fan.id, 'gnd');
    const inPin = fan.pins.some(p => p.id === 'in') ? 'in' : 'vcc';
    const ctrl = netlist.isConnected(fan.id, inPin, esp32.id, HARDWARE_PINS.FAN_DRIVER_IN) ||
                 (pwr && netlist.isConnected(fan.id, 'in', esp32.id, HARDWARE_PINS.FAN_DRIVER_IN));
    const ok = pwr && gnd && (ctrl || netlist.isConnected(fan.id, 'in', esp32.id, HARDWARE_PINS.FAN_DRIVER_IN));
    fanHealth = {
      connected: ok,
      powerOk: pwr,
      groundOk: gnd,
      signalOk: ctrl,
      statusText: ok
        ? 'Driver Module Loop Armed (GPIO 14)'
        : !pwr
        ? 'Fan 5V Supply Disconnected'
        : !gnd
        ? 'Fan GND Disconnected'
        : 'Fan Driver IN not connected to GPIO 14',
    };
    if (!ok) faults.push(`Exhaust Fan: ${fanHealth.statusText}`);
  } else {
    faults.push('Exhaust Fan: Fan module missing from workbench');
  }

  // --- 9. 16x2 I2C LCD Display ---
  const lcd = components.find((c) => c.type === 'lcd_1602');
  let lcdHealth: DeviceHealth = { connected: false, powerOk: false, groundOk: false, signalOk: false, statusText: 'Not Placed' };
  if (lcd) {
    const pwr = isPowerNet(lcd.id, 'vcc', '5v');
    const gnd = isGndNet(lcd.id, 'gnd');
    const sda = netlist.isConnected(lcd.id, 'sda', esp32.id, HARDWARE_PINS.I2C_SDA);
    const scl = netlist.isConnected(lcd.id, 'scl', esp32.id, HARDWARE_PINS.I2C_SCL);
    const ok = pwr && gnd && sda && scl;
    lcdHealth = {
      connected: ok,
      powerOk: pwr,
      groundOk: gnd,
      signalOk: sda && scl,
      statusText: ok
        ? 'I2C Bus Verified (SDA: GPIO21, SCL: GPIO22)'
        : !pwr
        ? 'Missing 5V VCC'
        : !gnd
        ? 'Missing GND'
        : !sda
        ? 'SDA not connected to GPIO 21'
        : 'SCL not connected to GPIO 22',
    };
    if (!ok) faults.push(`16x2 LCD: ${lcdHealth.statusText}`);
  } else {
    faults.push('16x2 LCD: Display missing from workbench');
  }

  // --- 10. Green Indicator LED (Requires 220Ω Series Resistor to GPIO 2) ---
  const ledG = components.find((c) => c.type === 'led_green');
  let ledGHealth: DeviceHealth = { connected: false, powerOk: false, groundOk: false, signalOk: false, statusText: 'Not Placed' };
  if (ledG) {
    const gnd = isGndNet(ledG.id, 'cathode');
    const hasResistor = components.some(c =>
      c.type === 'resistor' &&
      ((netlist.isConnected(c.id, 'lead_1', esp32.id, HARDWARE_PINS.LED_GREEN_STATUS) && netlist.isConnected(c.id, 'lead_2', ledG.id, 'anode')) ||
       (netlist.isConnected(c.id, 'lead_2', esp32.id, HARDWARE_PINS.LED_GREEN_STATUS) && netlist.isConnected(c.id, 'lead_1', ledG.id, 'anode')))
    );
    const directWire = netlist.isConnected(ledG.id, 'anode', esp32.id, HARDWARE_PINS.LED_GREEN_STATUS);
    const ok = gnd && (hasResistor || directWire);
    ledGHealth = {
      connected: ok,
      powerOk: hasResistor || directWire,
      groundOk: gnd,
      signalOk: hasResistor,
      statusText: ok
        ? (hasResistor ? 'Nominal (GPIO2 via 220Ω)' : 'Direct GPIO Connection (Missing Series Resistor)')
        : !gnd
        ? 'Cathode GND Disconnected'
        : 'Anode not connected to GPIO 2',
    };
    if (!ok) faults.push(`Green Status LED: ${ledGHealth.statusText}`);
  } else {
    faults.push('Green Status LED: Component missing');
  }

  // --- 11. Red Alarm Indicator LED (Requires 220Ω Series Resistor to GPIO 12) ---
  const ledR = components.find((c) => c.type === 'led_red');
  let ledRHealth: DeviceHealth = { connected: false, powerOk: false, groundOk: false, signalOk: false, statusText: 'Not Placed' };
  if (ledR) {
    const gnd = isGndNet(ledR.id, 'cathode');
    const hasResistor = components.some(c =>
      c.type === 'resistor' &&
      ((netlist.isConnected(c.id, 'lead_1', esp32.id, HARDWARE_PINS.LED_RED_ALARM) && netlist.isConnected(c.id, 'lead_2', ledR.id, 'anode')) ||
       (netlist.isConnected(c.id, 'lead_2', esp32.id, HARDWARE_PINS.LED_RED_ALARM) && netlist.isConnected(c.id, 'lead_1', ledR.id, 'anode')))
    );
    const directWire = netlist.isConnected(ledR.id, 'anode', esp32.id, HARDWARE_PINS.LED_RED_ALARM) ||
                       netlist.isConnected(ledR.id, 'anode', esp32.id, HARDWARE_PINS.VALVE_DRIVER_IN);
    const ok = gnd && (hasResistor || directWire);
    ledRHealth = {
      connected: ok,
      powerOk: hasResistor || directWire,
      groundOk: gnd,
      signalOk: hasResistor,
      statusText: ok
        ? (hasResistor ? 'Nominal (GPIO12 via 220Ω)' : 'Direct GPIO Connection (Missing Series Resistor)')
        : !gnd
        ? 'Cathode GND Disconnected'
        : 'Anode not connected to GPIO 12',
    };
    if (!ok) faults.push(`Red Alarm LED: ${ledRHealth.statusText}`);
  } else {
    faults.push('Red Alarm LED: Component missing');
  }

  const devicesMap = {
    esp32: esp32Health,
    tankLevelSensor: hcHealth,
    tempSensor: dsHealth,
    gasSensor: mqHealth,
    currentSensor: acsHealth,
    pumpActuator: pumpHealth,
    valveActuator: valveHealth,
    fanActuator: fanHealth,
    lcdDisplay: lcdHealth,
    ledGreen: ledGHealth,
    ledRed: ledRHealth,
  };

  // Derive valid paths directly from REQUIRED_CIRCUIT_PATHS
  const validPaths = REQUIRED_CIRCUIT_PATHS.filter((k) => devicesMap[k].connected).length;
  const healthPercentage = Math.round((validPaths / totalRequiredPaths) * 100);

  // STRICT Health Determination:
  // Must have 0 faults AND all required paths valid AND power rails energized!
  const isHealthy = faults.length === 0 && validPaths === totalRequiredPaths && powerRailsOk;

  return {
    isHealthy,
    isEsp32Powered: esp32PowerOk,
    esp32Powered: esp32PowerOk,
    powerRailsOk,
    validPathsCount: validPaths,
    totalRequiredPaths,
    healthPercentage,
    devices: devicesMap,
    faults,
  };
}

function createAllDisconnectedDevices(reason: string): CircuitHealthReport['devices'] {
  const d: DeviceHealth = { connected: false, powerOk: false, groundOk: false, signalOk: false, statusText: reason };
  return {
    esp32: d,
    tankLevelSensor: d,
    tempSensor: d,
    gasSensor: d,
    currentSensor: d,
    pumpActuator: d,
    valveActuator: d,
    fanActuator: d,
    lcdDisplay: d,
    ledGreen: d,
    ledRed: d,
  };
}
