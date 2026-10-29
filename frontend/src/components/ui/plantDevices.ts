import type { LucideIcon } from 'lucide-react';
import { ArrowDownToLine, BatteryCharging, CloudSun, Cpu, Droplets, Fan, Flame, Thermometer, Waves, Zap } from 'lucide-react';
import type { ActuatorKey, PlantSample } from '../../hooks/usePlantLive';

export type MetricKey =
  | 'tank_level' | 'temperature' | 'gas_ppm' | 'current_draw' | 'gas_sensor_mv'
  | 'supply_voltage' | 'ambient_temp' | 'humidity' | 'pressure_hpa';

export interface MetricDef {
  key: MetricKey;
  label: string;
  unit: string;
  decimals: number;
  // Same limits as backend/process_policy.py evaluate_process_health.
  warnLow?: number;
  warnHigh?: number;
  tripHigh?: number;
}

export const METRICS: Record<MetricKey, MetricDef> = {
  tank_level: { key: 'tank_level', label: 'Tank level', unit: '%', decimals: 1, warnLow: 25, warnHigh: 78, tripHigh: 88 },
  temperature: { key: 'temperature', label: 'Water temperature', unit: '°C', decimals: 1, warnHigh: 50, tripHigh: 70 },
  gas_ppm: { key: 'gas_ppm', label: 'Gas concentration', unit: 'ppm', decimals: 0, warnHigh: 80, tripHigh: 250 },
  current_draw: { key: 'current_draw', label: 'Pump current', unit: 'A', decimals: 2, warnHigh: 2.8, tripHigh: 3.8 },
  gas_sensor_mv: { key: 'gas_sensor_mv', label: 'MQ-2 output', unit: 'mV', decimals: 0 },
  supply_voltage: { key: 'supply_voltage', label: 'Supply voltage', unit: 'V', decimals: 1 },
  ambient_temp: { key: 'ambient_temp', label: 'Ambient temperature', unit: '°C', decimals: 1 },
  humidity: { key: 'humidity', label: 'Humidity', unit: '%', decimals: 0 },
  pressure_hpa: { key: 'pressure_hpa', label: 'Pressure', unit: 'hPa', decimals: 1 },
};

export interface DeviceDef {
  id: string;
  name: string;
  part: string;
  kind: 'sensor' | 'actuator' | 'controller';
  icon: LucideIcon;
  senses: string;
  wiring: string;
  metrics: MetricKey[];
  actuator?: ActuatorKey;
}

// Pins follow firmware/scada_master_firmware/scada_master_firmware.ino.
export const DEVICES: DeviceDef[] = [
  {
    id: 'level', name: 'Tank level', part: 'HC-SR04 ultrasonic', kind: 'sensor', icon: Waves,
    senses: 'Distance from the sensor to the water surface, converted to percent full using the tank depth.',
    wiring: 'TRIG GPIO25 · ECHO GPIO34', metrics: ['tank_level'],
  },
  {
    id: 'temperature', name: 'Water temperature', part: 'DS18B20 probe', kind: 'sensor', icon: Thermometer,
    senses: 'Process water temperature over the 1-Wire bus.',
    wiring: 'DATA GPIO4 · 4.7 kΩ pull-up to 3.3 V', metrics: ['temperature'],
  },
  {
    id: 'gas', name: 'Combustible gas', part: 'MQ-2 sensor', kind: 'sensor', icon: Flame,
    senses: 'LPG / smoke concentration from the heated sensing element; the bridge converts its output voltage to ppm.',
    wiring: 'AO GPIO32 through a divider', metrics: ['gas_ppm', 'gas_sensor_mv'],
  },
  {
    id: 'current', name: 'Pump current', part: 'ACS712-05B', kind: 'sensor', icon: Zap,
    senses: 'Current drawn by the pump motor (Hall effect, 185 mV/A); used for overload and dry-run detection.',
    wiring: 'OUT GPIO33 · in series with the pump supply', metrics: ['current_draw'],
  },
  {
    id: 'supply', name: 'Supply voltage', part: 'Voltage sensor module', kind: 'sensor', icon: BatteryCharging,
    senses: '12 V rail voltage through a 5:1 divider.',
    wiring: 'S GPIO35', metrics: ['supply_voltage'],
  },
  {
    id: 'ambient', name: 'Ambient conditions', part: 'BME280', kind: 'sensor', icon: CloudSun,
    senses: 'Room temperature, humidity and pressure, used to compensate the MQ-2 reading.',
    wiring: 'I²C SDA GPIO21 · SCL GPIO22', metrics: ['ambient_temp', 'humidity', 'pressure_hpa'],
  },
  {
    id: 'pump', name: 'Inflow pump', part: 'Mini pump · relay CH1', kind: 'actuator', icon: Droplets,
    senses: 'Fills the tank. Tripped off on overflow, gas, temperature or overcurrent.',
    wiring: 'Relay IN GPIO26 (active LOW)', metrics: ['current_draw'], actuator: 'pump_active',
  },
  {
    id: 'valve', name: 'Drain valve', part: 'Solenoid valve · relay CH2', kind: 'actuator', icon: ArrowDownToLine,
    senses: 'Drains the tank. Forced open when the level reaches the overflow limit.',
    wiring: 'Relay IN GPIO27 (active LOW)', metrics: ['tank_level'], actuator: 'valve_open',
  },
  {
    id: 'fan', name: 'Exhaust fan', part: '12 V fan · relay CH3', kind: 'actuator', icon: Fan,
    senses: 'Clears gas from the enclosure. Forced on above 80 ppm until the gas drops below 45 ppm.',
    wiring: 'Relay IN GPIO14 (active LOW)', metrics: ['gas_ppm'], actuator: 'fan_active',
  },
  {
    id: 'controller', name: 'Edge controller', part: 'ESP32 DevKit V1', kind: 'controller', icon: Cpu,
    senses: 'Samples every sensor, drives the relays and serves telemetry to LabVIEW over Wi-Fi.',
    wiring: 'Wi-Fi AP SCADA-EDGE-NODE · 192.168.4.1', metrics: [],
  },
];

export type Level = 'ok' | 'warning' | 'critical' | 'missing';

export function metricValue(sample: PlantSample | null, key: MetricKey): number | null {
  const value = sample?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function metricLevel(metric: MetricDef, value: number | null): Level {
  if (value === null) return 'missing';
  if (metric.tripHigh !== undefined && value >= metric.tripHigh) return 'critical';
  if ((metric.warnHigh !== undefined && value >= metric.warnHigh) || (metric.warnLow !== undefined && value <= metric.warnLow)) {
    return 'warning';
  }
  return 'ok';
}

export function formatValue(metric: MetricDef, value: number | null): string {
  return value === null ? '—' : value.toFixed(metric.decimals);
}
