/**
 * Single Source of Truth for SCADA Lab 3D Pin Mappings, Protocol Addresses & Hardware Specifications.
 * Synchronized across Circuit Validator, Simulation Engine, C++ Firmware, UI Tooltips, and Modbus Map.
 */

export const HARDWARE_PINS = {
  // Power & Ground
  ESP32_VIN: 'pin_vin',
  ESP32_3V3: 'pin_3v3',
  ESP32_GND_1: 'pin_gnd_1',
  ESP32_GND_2: 'pin_gnd_2',

  // Sensors
  HC_SR04_TRIG: 'pin_gpio25',
  HC_SR04_ECHO: 'pin_gpio34',
  DS18B20_DATA: 'pin_gpio4',
  MQ2_AO: 'pin_gpio32',
  ACS712_OUT: 'pin_gpio33',

  // Actuator Drivers
  RELAY_PUMP_IN: 'pin_gpio26',
  VALVE_DRIVER_IN: 'pin_gpio27',
  FAN_DRIVER_IN: 'pin_gpio14',

  // Indicators
  LED_GREEN_STATUS: 'pin_gpio2',
  LED_RED_ALARM: 'pin_gpio12',

  // I2C Bus
  I2C_SDA: 'pin_gpio21',
  I2C_SCL: 'pin_gpio22',
} as const;

export const PIN_METADATA = {
  [HARDWARE_PINS.HC_SR04_TRIG]: {
    label: 'GPIO 25',
    role: 'HC-SR04 Ultrasonic TRIG Pulse (Digital Output)',
    voltage: '3.3V Logic',
  },
  [HARDWARE_PINS.HC_SR04_ECHO]: {
    label: 'GPIO 34',
    role: 'HC-SR04 Ultrasonic ECHO (Input via 5V->3.3V Divider)',
    voltage: '3.3V Safe (Divider)',
  },
  [HARDWARE_PINS.DS18B20_DATA]: {
    label: 'GPIO 4',
    role: 'DS18B20 1-Wire Bidirectional (4.7kΩ Pull-up to 3.3V)',
    voltage: '3.3V Logic',
  },
  [HARDWARE_PINS.MQ2_AO]: {
    label: 'GPIO 32',
    role: 'MQ-2 Gas Sensor Analog Output (ADC1_CH4, 0-4095)',
    voltage: '0 - 3.3V Analog',
  },
  [HARDWARE_PINS.ACS712_OUT]: {
    label: 'GPIO 33',
    role: 'ACS712 Motor Current Analog Output (ADC1_CH5, 0-4095)',
    voltage: '0 - 3.3V Analog',
  },
  [HARDWARE_PINS.RELAY_PUMP_IN]: {
    label: 'GPIO 26',
    role: 'Feed Pump 5V Relay Coil Control IN (Active HIGH)',
    voltage: '3.3V Control',
  },
  [HARDWARE_PINS.VALVE_DRIVER_IN]: {
    label: 'GPIO 27',
    role: 'Emergency Drain Solenoid Driver IN (Active HIGH)',
    voltage: '3.3V Control',
  },
  [HARDWARE_PINS.FAN_DRIVER_IN]: {
    label: 'GPIO 14',
    role: 'Hazardous Gas Exhaust Fan Driver IN (Active HIGH)',
    voltage: '3.3V Control',
  },
  [HARDWARE_PINS.LED_GREEN_STATUS]: {
    label: 'GPIO 2',
    role: 'Green Status Indicator LED (via 220Ω Series Resistor)',
    voltage: '3.3V Output',
  },
  [HARDWARE_PINS.LED_RED_ALARM]: {
    label: 'GPIO 12',
    role: 'Red Alarm Trip Indicator LED (via 220Ω Series Resistor)',
    voltage: '3.3V Output',
  },
  [HARDWARE_PINS.I2C_SDA]: {
    label: 'GPIO 21',
    role: '16x2 LCD I2C Data (SDA)',
    voltage: '3.3V / 5V Bus',
  },
  [HARDWARE_PINS.I2C_SCL]: {
    label: 'GPIO 22',
    role: '16x2 LCD I2C Clock (SCL)',
    voltage: '3.3V / 5V Bus',
  },
} as const;

/** Standard DallasTemperature open-circuit reading */
export const DEVICE_DISCONNECTED_C = -127.0;

/** Modbus Register Mapping */
export const MODBUS_MAP = {
  HOLDING_REGISTERS: {
    TANK_LEVEL: { human: 40001, pduOffset: 0, scale: 10, unit: '%', desc: 'Process Tank Level' },
    TEMPERATURE: { human: 40002, pduOffset: 1, scale: 10, unit: '°C', desc: 'Reactor Temperature' },
    GAS_PPM: { human: 40003, pduOffset: 2, scale: 1, unit: 'PPM', desc: 'Toxic/VOC Gas Concentration' },
    CURRENT: { human: 40004, pduOffset: 3, scale: 100, unit: 'A', desc: 'Pump Motor Current Draw' },
  },
  COILS: {
    PUMP: { human: 1, pduOffset: 0, desc: 'Feed Pump Relay Output' },
    VALVE: { human: 2, pduOffset: 1, desc: 'Drain Solenoid Valve Driver' },
    FAN: { human: 3, pduOffset: 2, desc: 'Exhaust Ventilation Fan Driver' },
  },
} as const;
