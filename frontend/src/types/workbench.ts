export type PinType = 'POWER_VCC' | 'GROUND' | 'ANALOG' | 'DIGITAL_GPIO' | 'I2C' | 'RELAY_CONTACT';

export interface PinDefinition {
  id: string;
  name: string;
  type: PinType;
  relativePosition: [number, number, number]; // [x, y, z] relative to component center
  description?: string;
}

export interface WorkbenchComponent {
  id: string;
  type: 
    | 'esp32'
    | 'breadboard'
    | 'hc_sr04'
    | 'acs712'
    | 'relay'
    | 'ds18b20'
    | 'mq2'
    | 'lcd_1602'
    | 'pump'
    | 'valve'
    | 'fan'
    | 'led_red'
    | 'led_green'
    | 'resistor';
  name: string;
  modelPath: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  pins: PinDefinition[];
}

export interface WireConnection {
  id: string;
  fromComponentId: string;
  fromPinId: string;
  toComponentId: string;
  toPinId: string;
  color: string;
  sag: number; // gravitational droop factor (0.1 = subtle, 0.6 = deep droop)
}

export interface WireDraft {
  fromComponentId: string;
  fromPinId: string;
  currentColor: string;
}

export interface LiveTelemetry {
  tank_level: number;      // 0 - 100%
  temperature: number;     // 0 - 100 °C
  gas_ppm: number;         // 0 - 1000 PPM
  current_draw: number;    // 0 - 5.00 A
  pump_active: boolean;    // Inflow Pump State
  valve_open: boolean;     // Emergency Drain Valve
  fan_active: boolean;     // Safety Exhaust Fan
  status_class: 0 | 1 | 2; // 0: Normal, 1: Warning, 2: Fault
}

export interface SerialLogEntry {
  id: string;
  timestamp: string;
  level: 'BOOT' | 'INFO' | 'WARN' | 'ALARM' | 'MODBUS' | 'GPIO';
  message: string;
}
