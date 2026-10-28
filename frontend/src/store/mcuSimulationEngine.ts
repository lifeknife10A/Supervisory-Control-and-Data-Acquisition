import type { LiveTelemetry, SerialLogEntry } from '../types/workbench';
import type { CircuitHealthReport } from './circuitValidator';
import { DEVICE_DISCONNECTED_C } from '../constants/pinMapping';

/** Shared scheduler interval for the illustrative process model (not circuit physics). */
export const SIMULATION_TICK_MS = 300;

export interface MCUState {
  bootEpoch: number;
  isBooted: boolean;
  uptimeSeconds: number;
  freeHeap: number;
  cpuFreqMHz: number;
  wifiConnected: boolean;
  ipAddress: string;
  modbusClients: number;
  gpioStates: {
    gpio2: boolean;   // Builtin Blue LED
    gpio26: boolean;  // Pump Relay IN1
    gpio27: boolean;  // Drain Valve Relay IN2
    gpio14: boolean;  // Exhaust Fan
    gpio21: boolean;  // I2C SDA
    gpio22: boolean;  // I2C SCL
    adc34: number;    // Raw ADC for Tank Level
    adc35: number;    // Raw ADC for Temp
    adc32: number;    // Raw ADC for Gas
    adc33: number;    // Raw ADC for Current
  };
  modbusRegisters: {
    40001: number; // Tank Level * 10 (Protocol Offset 0)
    40002: number; // Process Temp * 10 (Protocol Offset 1)
    40003: number; // Gas PPM (Protocol Offset 2)
    40004: number; // Motor Current * 100 (Protocol Offset 3)
  };
  modbusCoils: {
    1: boolean; // Pump Relay Coil (Protocol Offset 0)
    2: boolean; // Emergency Valve Coil (Protocol Offset 1)
    3: boolean; // Exhaust Fan Coil (Protocol Offset 2)
  };
}

export function getInitialMCUState(): MCUState {
  return {
    bootEpoch: Math.floor(Date.now() / 1000),
    isBooted: true,
    uptimeSeconds: 0,
    freeHeap: 284160,
    cpuFreqMHz: 240,
    wifiConnected: true,
    ipAddress: '192.168.1.142 (Simulated)',
    modbusClients: 1,
    gpioStates: {
      gpio2: true,
      gpio26: true,
      gpio27: false,
      gpio14: false,
      gpio21: true,
      gpio22: true,
      adc34: 2218,
      adc35: 1205,
      adc32: 90,
      adc33: 1350,
    },
    modbusRegisters: {
      40001: 542,
      40002: 294,
      40003: 22,
      40004: 165,
    },
    modbusCoils: {
      1: true,
      2: false,
      3: false,
    },
  };
}

export function generateBootLogs(): SerialLogEntry[] {
  const now = new Date();
  const formatTime = (offsetMs: number) => {
    const d = new Date(now.getTime() + offsetMs);
    return d.toTimeString().split(' ')[0];
  };

  return [
    {
      id: `boot_${Date.now()}_1`,
      timestamp: formatTime(-950),
      level: 'BOOT',
      message: 'rst:0x1 (POWERON_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)',
    },
    {
      id: `boot_${Date.now()}_2`,
      timestamp: formatTime(-900),
      level: 'BOOT',
      message: 'configsip: 0, SPIWP:0xee | mode:DIO, clock div:1 (40MHz)',
    },
    {
      id: `boot_${Date.now()}_3`,
      timestamp: formatTime(-850),
      level: 'BOOT',
      message: 'load:0x3fff0030,len:1184 | load:0x40078000,len:13104 | entry 0x400805e4',
    },
    {
      id: `boot_${Date.now()}_4`,
      timestamp: formatTime(-750),
      level: 'INFO',
      message: '[ESP32-D0WDQ6] Xtensa Dual-Core LX6 @ 240MHz | Rev 1 | 4MB Flash [In-Browser Simulation]',
    },
    {
      id: `boot_${Date.now()}_5`,
      timestamp: formatTime(-600),
      level: 'INFO',
      message: '[WIFI-SIM] Connecting to Industrial-SCADA-AP (SSID: SCADA_VLAN_10)...',
    },
    {
      id: `boot_${Date.now()}_6`,
      timestamp: formatTime(-400),
      level: 'INFO',
      message: '[WIFI-SIM] Connected! Virtual Station IP: 192.168.1.142 | Gateway: 192.168.1.1',
    },
    {
      id: `boot_${Date.now()}_7`,
      timestamp: formatTime(-300),
      level: 'MODBUS',
      message: '[MODBUS-SIM] In-Memory Server listening (Slave ID: 0x01, Port 502)',
    },
    {
      id: `boot_${Date.now()}_8`,
      timestamp: formatTime(-200),
      level: 'INFO',
      message: '[I2C-BUS] Scanning Wire bus: Found LCD1602 HD44780 at Addr 0x27',
    },
    {
      id: `boot_${Date.now()}_9`,
      timestamp: formatTime(-100),
      level: 'GPIO',
      message: '[GPIO] Configured Pin 26 (Pump Relay), Pin 27 (Valve Relay), Pin 14 (Exhaust Fan)',
    },
    {
      id: `boot_${Date.now()}_10`,
      timestamp: formatTime(0),
      level: 'INFO',
      message: `[SCADA-CORE] Control Loop active (${SIMULATION_TICK_MS}ms tick). Type "help" in terminal for commands.`,
    },
  ];
}

/**
 * Closed-Loop Virtual MCU execution step with circuit connectivity validation & strict range clamping.
 */
export function executeMCUControlStep(
  currentTelemetry: LiveTelemetry,
  mcuState: MCUState,
  logCounter: number,
  circuitHealth?: CircuitHealthReport,
  controlMode: 'auto' | 'manual' | 'fault_injection' = 'auto',
  advanceSimulation = true
): {
  updatedTelemetry: LiveTelemetry;
  updatedMCUState: MCUState;
  newLogs: SerialLogEntry[];
} {
  const nowStr = new Date().toTimeString().split(' ')[0];
  const newLogs: SerialLogEntry[] = [];
  const telemetry = { ...currentTelemetry };
  const state: MCUState = {
    ...mcuState,
    uptimeSeconds: parseFloat((mcuState.uptimeSeconds + (advanceSimulation ? SIMULATION_TICK_MS / 1000 : 0)).toFixed(2)),
    freeHeap: advanceSimulation ? Math.max(250000, mcuState.freeHeap + Math.floor((Math.random() - 0.5) * 64)) : mcuState.freeHeap,
    gpioStates: { ...mcuState.gpioStates },
    modbusRegisters: { ...mcuState.modbusRegisters },
    modbusCoils: { ...mcuState.modbusCoils },
  };

  // 1. Check Circuit Hardware Connectivity
  if (circuitHealth) {
    if (!circuitHealth.isEsp32Powered) {
      // Board is completely unpowered
      telemetry.tank_level = 0;
      telemetry.pump_active = false;
      telemetry.valve_open = false;
      telemetry.fan_active = false;
      telemetry.temperature = DEVICE_DISCONNECTED_C;
      telemetry.gas_ppm = 0;
      telemetry.current_draw = 0;
      telemetry.tank_level = 0;
      telemetry.status_class = 2;

      state.gpioStates.gpio2 = false;
      state.gpioStates.gpio26 = false;
      state.gpioStates.gpio27 = false;
      state.gpioStates.gpio14 = false;
      state.gpioStates.adc34 = 0;
      state.gpioStates.adc35 = 0;
      state.gpioStates.adc32 = 0;
      state.gpioStates.adc33 = 0;

      state.modbusRegisters[40001] = 0;
      state.modbusRegisters[40002] = Math.round(DEVICE_DISCONNECTED_C * 10);
      state.modbusRegisters[40003] = 0;
      state.modbusRegisters[40004] = 0;
      state.modbusCoils[1] = false;
      state.modbusCoils[2] = false;
      state.modbusCoils[3] = false;

      if (logCounter % 4 === 0) {
        newLogs.push({
          id: `power_fault_${Date.now()}`,
          timestamp: nowStr,
          level: 'ALARM',
          message: '[HARDWARE FAULT] ESP32 DevKit V1 unpowered! Connect 5V/VIN and GND jumper wires to breadboard rails.',
        });
      }

      return {
        updatedTelemetry: telemetry,
        updatedMCUState: state,
        newLogs,
      };
    }

    // Individual Sensor Disconnects
    if (!circuitHealth.devices.tankLevelSensor.connected) {
      telemetry.tank_level = 0.0;
      if (logCounter % 6 === 0) {
        newLogs.push({
          id: `hc_err_${Date.now()}`,
          timestamp: nowStr,
          level: 'WARN',
          message: '[SENSOR OPEN] HC-SR04 Tank Level Sensor signal disconnected from GPIO 34 (Echo duration = 0).',
        });
      }
    }

    if (!circuitHealth.devices.tempSensor.connected) {
      telemetry.temperature = DEVICE_DISCONNECTED_C; // Standard DallasTemperature disconnected code (-127.0°C)
      if (logCounter % 6 === 0) {
        newLogs.push({
          id: `ds_err_${Date.now()}`,
          timestamp: nowStr,
          level: 'WARN',
          message: '[SENSOR OPEN] DS18B20 Temp Probe disconnected from 1-Wire GPIO 4 (reading DEVICE_DISCONNECTED_C: -127.0°C).',
        });
      }
    }

    if (!circuitHealth.devices.gasSensor.connected) {
      telemetry.gas_ppm = 0.0;
      if (logCounter % 6 === 0) {
        newLogs.push({
          id: `mq_err_${Date.now()}`,
          timestamp: nowStr,
          level: 'WARN',
          message: '[SENSOR OPEN] MQ-2 Gas Sensor Analog OUT disconnected from GPIO 32.',
        });
      }
    }

    if (!circuitHealth.devices.currentSensor.connected) {
      telemetry.current_draw = 0.0;
    }
  }

  // 2. Illustrative process dynamics (not electrical hardware simulation)
  const isTankConnected = !circuitHealth || circuitHealth.devices.tankLevelSensor.connected;
  const isTempConnected = !circuitHealth || circuitHealth.devices.tempSensor.connected;
  const isGasConnected = !circuitHealth || circuitHealth.devices.gasSensor.connected;
  const isCurrentConnected = !circuitHealth || circuitHealth.devices.currentSensor.connected;

  if (advanceSimulation && isTankConnected) {
    if (telemetry.pump_active) {
      telemetry.tank_level = Math.min(100, telemetry.tank_level + (0.55 + Math.random() * 0.3));
    } else {
      telemetry.tank_level = Math.max(0, telemetry.tank_level - (0.2 + Math.random() * 0.15));
    }

    if (telemetry.valve_open) {
      telemetry.tank_level = Math.max(0, telemetry.tank_level - (1.8 + Math.random() * 0.5));
    }
  }

  if (advanceSimulation && isCurrentConnected) {
    if (telemetry.pump_active) {
      if (telemetry.current_draw < 3.5) {
        telemetry.current_draw = parseFloat((1.6 + Math.random() * 0.25).toFixed(2));
      }
    } else {
      telemetry.current_draw = parseFloat((0.08 + Math.random() * 0.04).toFixed(2));
    }
  }

  if (advanceSimulation && isTempConnected && telemetry.temperature !== DEVICE_DISCONNECTED_C) {
    telemetry.temperature = parseFloat((telemetry.temperature + (Math.random() - 0.49) * 0.18).toFixed(1));
  }

  if (advanceSimulation && isGasConnected) {
    telemetry.gas_ppm = parseFloat(Math.max(10, telemetry.gas_ppm + (Math.random() - 0.51) * 1.5).toFixed(1));
  }

  // 3. Strict Physical Clamping
  telemetry.tank_level = Math.min(100.0, Math.max(0.0, parseFloat(telemetry.tank_level.toFixed(1))));
  if (telemetry.temperature !== DEVICE_DISCONNECTED_C) {
    telemetry.temperature = Math.min(100.0, Math.max(0.0, parseFloat(telemetry.temperature.toFixed(1))));
  }
  telemetry.gas_ppm = Math.min(1000.0, Math.max(0.0, parseFloat(telemetry.gas_ppm.toFixed(1))));
  telemetry.current_draw = Math.min(5.00, Math.max(0.0, parseFloat(telemetry.current_draw.toFixed(2))));

  // 4. Master Supervisory Safety Policy
  const highTankAlarm = telemetry.tank_level >= 88.0;
  const highGasWarn = telemetry.gas_ppm >= 80.0;
  const criticalGasTrip = telemetry.gas_ppm >= 250.0;
  const overCurrentTrip = telemetry.current_draw >= 3.8;
  const overTempTrip = telemetry.temperature !== DEVICE_DISCONNECTED_C && telemetry.temperature >= 70.0;
  const lowTankFill = telemetry.tank_level <= 25.0;
  const criticalDryRun = telemetry.tank_level <= 2.0;
  const sensorFault = telemetry.temperature === DEVICE_DISCONNECTED_C || !isTankConnected;

  // Any critical condition triggers the Master Safety Trip
  const criticalSafetyTrip = highTankAlarm || criticalGasTrip || overCurrentTrip || overTempTrip || criticalDryRun;

  let desiredPump = telemetry.pump_active;
  let desiredValve = telemetry.valve_open;
  let desiredFan = telemetry.fan_active;

  if (controlMode === 'auto') {
    if (criticalSafetyTrip || sensorFault) {
      // General Critical Safety Trip: Feed Pump MUST immediately trip OFF!
      desiredPump = false;
      if (highTankAlarm) desiredValve = true;
      if (criticalGasTrip || overTempTrip) desiredFan = true;
    } else {
      // Normal operating loop
      if (lowTankFill && !sensorFault) {
        desiredPump = true;
        desiredValve = false;
      } else if (telemetry.tank_level < 80.0 && desiredValve) {
        desiredValve = false;
      }

      if (highGasWarn) {
        desiredFan = true;
      } else if (telemetry.gas_ppm < 45.0 && (telemetry.temperature === DEVICE_DISCONNECTED_C || telemetry.temperature < 40.0)) {
        desiredFan = false;
      }
    }
  } else if (controlMode === 'manual') {
    // Hard physical safety overrides manual control during destructive overcurrent, tank overflow, or dry-run cavitation risk
    if (criticalSafetyTrip || sensorFault) {
      desiredPump = false;
      if (highTankAlarm) desiredValve = true;
      if (criticalGasTrip || overTempTrip) desiredFan = true;
    }
  }

  // 5. Actuator Output Connection Masking
  // Disconnected or unpowered actuators can NEVER spin, open, or be active
  const pumpCircuitOk = Boolean(!circuitHealth || circuitHealth.devices.pumpActuator.connected);
  const valveCircuitOk = Boolean(!circuitHealth || circuitHealth.devices.valveActuator.connected);
  const fanCircuitOk = Boolean(!circuitHealth || circuitHealth.devices.fanActuator.connected);

  const finalPump = desiredPump && pumpCircuitOk;
  const finalValve = desiredValve && valveCircuitOk;
  const finalFan = desiredFan && fanCircuitOk;

  // 6. Edge-Triggered Transition Logging (Log only when states change!)
  const prevPump = state.modbusCoils[1];
  const prevValve = state.modbusCoils[2];
  const prevFan = state.modbusCoils[3];

  if (finalPump !== prevPump) {
    if (!finalPump) {
      newLogs.push({
        id: `trip_pmp_${Date.now()}`,
        timestamp: nowStr,
        level: 'ALARM',
        message: `[SAFETY TRIP] Feed Pump stopped (GPIO 26 LOW). Reason: ${criticalSafetyTrip ? 'Critical Process Hazard' : !pumpCircuitOk ? 'Relay Circuit Open' : 'Tank Full'}`,
      });
    } else {
      newLogs.push({
        id: `start_pmp_${Date.now()}`,
        timestamp: nowStr,
        level: 'INFO',
        message: '[AUTO PUMP] Energizing Inflow Feed Pump (GPIO 26 HIGH). Low tank replenishment active.',
      });
    }
  }

  if (finalValve !== prevValve) {
    if (finalValve) {
      newLogs.push({
        id: `open_vlv_${Date.now()}`,
        timestamp: nowStr,
        level: 'ALARM',
        message: '[SAFETY DRAIN] Emergency Solenoid Valve opened (GPIO 27 HIGH). Overfill safety relief active.',
      });
    } else {
      newLogs.push({
        id: `close_vlv_${Date.now()}`,
        timestamp: nowStr,
        level: 'INFO',
        message: '[DRAIN CLOSED] Emergency Drain Valve closed (GPIO 27 LOW). Process level normalized.',
      });
    }
  }

  if (finalFan !== prevFan) {
    if (finalFan) {
      newLogs.push({
        id: `start_fan_${Date.now()}`,
        timestamp: nowStr,
        level: 'WARN',
        message: `[VENTILATION] Exhaust Fan started (GPIO 14 HIGH). Atmospheric remediation active (${telemetry.gas_ppm.toFixed(1)} PPM).`,
      });
    } else {
      newLogs.push({
        id: `stop_fan_${Date.now()}`,
        timestamp: nowStr,
        level: 'INFO',
        message: '[VENTILATION] Exhaust Fan Standby (GPIO 14 LOW). Atmospheric conditions normalized.',
      });
    }
  }

  // If Fan requested ON but circuit is disconnected, alert once on transition
  if (desiredFan && !fanCircuitOk && prevFan === false && logCounter % 10 === 0) {
    newLogs.push({
      id: `fan_unavail_${Date.now()}`,
      timestamp: nowStr,
      level: 'ALARM',
      message: '[ACTUATOR OPEN] Exhaust Fan commanded ON by safety loop, but Fan Supply/Driver circuit is disconnected!',
    });
  }

  // 7. Apply Final Actuator States to Telemetry
  telemetry.pump_active = finalPump;
  telemetry.valve_open = finalValve;
  telemetry.fan_active = finalFan;

  // 8. Determine Overall Status Class
  if (criticalSafetyTrip || sensorFault) {
    telemetry.status_class = 2; // Critical Alarm / Safety Trip
  } else if (highGasWarn || telemetry.current_draw > 2.3 || (telemetry.temperature !== DEVICE_DISCONNECTED_C && telemetry.temperature > 45) || telemetry.tank_level > 80 || lowTankFill) {
    telemetry.status_class = 1; // Warning
  } else {
    telemetry.status_class = 0; // Nominal
  }

  // 9. Synchronize MCU Hardware Pins & Modbus Registers
  state.gpioStates.gpio26 = finalPump;
  state.gpioStates.gpio27 = finalValve;
  state.gpioStates.gpio14 = finalFan;
  state.gpioStates.gpio2 = telemetry.status_class === 0; // Green Status LED

  state.gpioStates.adc34 = Math.min(4095, Math.max(0, Math.round((telemetry.tank_level / 100) * 4095)));
  state.gpioStates.adc35 = telemetry.temperature === DEVICE_DISCONNECTED_C ? 0 : Math.min(4095, Math.max(0, Math.round((telemetry.temperature / 100) * 4095)));
  state.gpioStates.adc32 = Math.min(4095, Math.max(0, Math.round((telemetry.gas_ppm / 1000) * 4095)));
  state.gpioStates.adc33 = Math.min(4095, Math.max(0, Math.round((telemetry.current_draw / 5.0) * 4095)));

  // Modbus Holding Registers
  state.modbusRegisters[40001] = Math.round(telemetry.tank_level * 10);
  state.modbusRegisters[40002] = telemetry.temperature === DEVICE_DISCONNECTED_C ? -1270 : Math.round(telemetry.temperature * 10);
  state.modbusRegisters[40003] = Math.round(telemetry.gas_ppm);
  state.modbusRegisters[40004] = Math.round(telemetry.current_draw * 100);

  // Modbus Coils
  state.modbusCoils[1] = finalPump;
  state.modbusCoils[2] = finalValve;
  state.modbusCoils[3] = finalFan;

  // Periodic Telemetry Modbus Transmission
  if (logCounter % 4 === 0) {
    newLogs.push({
      id: `poll_${Date.now()}_${logCounter}`,
      timestamp: nowStr,
      level: 'MODBUS',
      message: `[MODBUS POLL] HR0(Lvl)=${telemetry.tank_level.toFixed(1)}% | HR1(Temp)=${telemetry.temperature === DEVICE_DISCONNECTED_C ? 'ERR(-127)' : `${telemetry.temperature.toFixed(1)}°C`} | HR2(Gas)=${telemetry.gas_ppm.toFixed(0)}ppm | HR3(Motor)=${telemetry.current_draw.toFixed(2)}A | C0(Pump)=${finalPump ? 'ON' : 'OFF'} | C2(Fan)=${finalFan ? 'ON' : 'OFF'}`,
    });
  }

  return {
    updatedTelemetry: telemetry,
    updatedMCUState: state,
    newLogs,
  };
}

/**
 * Interactive Serial Monitor CLI Command Parser with Atomic Actuator/Modbus Synchronization.
 */
export function executeSerialCLICommand(
  rawCommand: string,
  mcuState: MCUState,
  telemetry: LiveTelemetry,
  callbacks: {
    reboot: () => void;
    setActuator: (actuator: 'pump' | 'valve' | 'fan', active: boolean) => void;
    clearLogs: () => void;
  }
): SerialLogEntry[] {
  const trimmed = rawCommand.trim();
  if (!trimmed) return [];

  const timestamp = new Date().toTimeString().split(' ')[0];
  const cmdLower = trimmed.toLowerCase();
  const parts = cmdLower.split(/\s+/);
  const root = parts[0];

  const results: SerialLogEntry[] = [
    {
      id: `cmd_echo_${Date.now()}`,
      timestamp,
      level: 'INFO',
      message: `> ${trimmed}`,
    },
  ];

  switch (root) {
    case 'help':
      results.push({
        id: `help_${Date.now()}`,
        timestamp,
        level: 'INFO',
        message:
          'ESP32 SCADA Terminal Commands:\n' +
          '  status             - Show MCU hardware stats, free heap & uptime\n' +
          '  reboot / reset     - Hardware reset ESP32 (simulates EN button)\n' +
          '  modbus             - Dump Modbus holding registers (HR 0-3) and coils (Coil 0-2)\n' +
          '  gpio               - Show real-time GPIO logic states and ADC counts\n' +
          '  set pump <1|0>     - Atomically energize/de-energize pump (updates GPIO 26 & Coil 0)\n' +
          '  set valve <1|0>    - Atomically open/close emergency drain valve (updates GPIO 27 & Coil 1)\n' +
          '  set fan <1|0>      - Atomically run/stop safety exhaust fan (updates GPIO 14 & Coil 2)\n' +
          '  clear              - Clear terminal log buffer',
      });
      break;

    case 'reboot':
    case 'reset':
      callbacks.reboot();
      return [];

    case 'clear':
    case 'cls':
      callbacks.clearLogs();
      return [];

    case 'status':
      results.push({
        id: `stat_${Date.now()}`,
        timestamp,
        level: 'INFO',
        message:
          `MCU: ESP32-D0WDQ6 @ ${mcuState.cpuFreqMHz}MHz [Local Simulation Engine]\n` +
          `Uptime: ${mcuState.uptimeSeconds}s | Free Heap: ${mcuState.freeHeap} bytes\n` +
          `WiFi: ${mcuState.wifiConnected ? 'SIMULATED CONNECTED' : 'DISCONNECTED'} (${mcuState.ipAddress})\n` +
          `Modbus In-Memory Server: Active (Port 502) | Status: ${telemetry.status_class === 0 ? 'NORMAL' : telemetry.status_class === 1 ? 'WARNING' : 'FAULT'}`,
      });
      break;

    case 'modbus':
      results.push({
        id: `mb_${Date.now()}`,
        timestamp,
        level: 'MODBUS',
        message:
          `[MODBUS-TCP SLAVE 1 REPORT]\n` +
          `  Address  Offset  Description           Raw Count  Engineering Value\n` +
          `  40001    0       Tank Level (x10)      ${mcuState.modbusRegisters[40001].toString().padEnd(10)} ${(mcuState.modbusRegisters[40001] / 10).toFixed(1)}%\n` +
          `  40002    1       Process Temp (x10)    ${mcuState.modbusRegisters[40002].toString().padEnd(10)} ${(mcuState.modbusRegisters[40002] / 10).toFixed(1)}°C\n` +
          `  40003    2       Gas Concentration     ${mcuState.modbusRegisters[40003].toString().padEnd(10)} ${mcuState.modbusRegisters[40003]} PPM\n` +
          `  40004    3       Motor Current (x100)  ${mcuState.modbusRegisters[40004].toString().padEnd(10)} ${(mcuState.modbusRegisters[40004] / 100).toFixed(2)}A\n` +
          `  00001    0       Pump Relay Coil       ${mcuState.modbusCoils[1] ? '1 (ENERGIZED)' : '0 (OFF)'}\n` +
          `  00002    1       Drain Valve Coil      ${mcuState.modbusCoils[2] ? '1 (OPEN)' : '0 (CLOSED)'}\n` +
          `  00003    2       Exhaust Fan Coil      ${mcuState.modbusCoils[3] ? '1 (RUN)' : '0 (STANDBY)'}`,
      });
      break;

    case 'gpio':
      results.push({
        id: `gpio_${Date.now()}`,
        timestamp,
        level: 'GPIO',
        message:
          `[GPIO PIN MAP]\n` +
          `  GPIO 2  (Builtin LED):  ${mcuState.gpioStates.gpio2 ? 'HIGH (1)' : 'LOW (0)'}\n` +
          `  GPIO 26 (Relay Pump):   ${mcuState.gpioStates.gpio26 ? 'HIGH (1)' : 'LOW (0)'}\n` +
          `  GPIO 27 (Relay Valve):  ${mcuState.gpioStates.gpio27 ? 'HIGH (1)' : 'LOW (0)'}\n` +
          `  GPIO 14 (Exhaust Fan):  ${mcuState.gpioStates.gpio14 ? 'HIGH (1)' : 'LOW (0)'}\n` +
          `  GPIO 34 (ADC Tank Lvl): ${mcuState.gpioStates.adc34} / 4095 (${(mcuState.gpioStates.adc34 * 3.3 / 4095).toFixed(2)}V)\n` +
          `  GPIO 35 (ADC Temp):     ${mcuState.gpioStates.adc35} / 4095 (${(mcuState.gpioStates.adc35 * 3.3 / 4095).toFixed(2)}V)\n` +
          `  GPIO 32 (ADC Gas PPM):  ${mcuState.gpioStates.adc32} / 4095 (${(mcuState.gpioStates.adc32 * 3.3 / 4095).toFixed(2)}V)\n` +
          `  GPIO 33 (ADC Current):  ${mcuState.gpioStates.adc33} / 4095 (${(mcuState.gpioStates.adc33 * 3.3 / 4095).toFixed(2)}V)`,
      });
      break;

    case 'set':
      if (parts[1] === 'pump') {
        const val = parts[2] === '1' || parts[2] === 'on' || parts[2] === 'true';
        callbacks.setActuator('pump', val);
        results.push({
          id: `cmd_res_${Date.now()}`,
          timestamp,
          level: 'GPIO',
          message: `OK: GPIO 26 (Pump Relay) & Modbus Coil 00001 (Offset 0) set to ${val ? 'HIGH / 1 (ENERGIZED)' : 'LOW / 0 (OFF)'}`,
        });
      } else if (parts[1] === 'valve') {
        const val = parts[2] === '1' || parts[2] === 'on' || parts[2] === 'true';
        callbacks.setActuator('valve', val);
        results.push({
          id: `cmd_res_${Date.now()}`,
          timestamp,
          level: 'GPIO',
          message: `OK: GPIO 27 (Emergency Valve) & Modbus Coil 00002 (Offset 1) set to ${val ? 'HIGH / 1 (OPEN)' : 'LOW / 0 (CLOSED)'}`,
        });
      } else if (parts[1] === 'fan') {
        const val = parts[2] === '1' || parts[2] === 'on' || parts[2] === 'true';
        callbacks.setActuator('fan', val);
        results.push({
          id: `cmd_res_${Date.now()}`,
          timestamp,
          level: 'GPIO',
          message: `OK: GPIO 14 (Exhaust Fan) & Modbus Coil 00003 (Offset 2) set to ${val ? 'HIGH / 1 (RUN)' : 'LOW / 0 (STANDBY)'}`,
        });
      } else {
        results.push({
          id: `cmd_err_${Date.now()}`,
          timestamp,
          level: 'WARN',
          message: `Syntax error: Unknown actuator "${parts[1]}". Usage: set <pump|valve|fan> <1|0>`,
        });
      }
      break;

    default:
      results.push({
        id: `cmd_err_${Date.now()}`,
        timestamp,
        level: 'WARN',
        message: `Command not recognized: "${rawCommand}". Type "help" for command listing.`,
      });
      break;
  }

  return results;
}

/**
 * Authentic Arduino C++ Sketch (main.cpp) powering this SCADA ESP32 controller.
 */
export const ESP32_FIRMWARE_SOURCE = `/*
 * SCADA Industrial Automation & Process Control Node
 * Target: ESP32 DevKit V1 (30-pin) | Framework: Arduino Core for ESP32
 * Features: Modbus TCP Server (Port 502), Dallas DS18B20 1-Wire, HC-SR04 Ultrasonic,
 *           MQ-2 Gas ADC, ACS712 Current ADC, BME280 Ambient I2C, 0-25V Supply Sensor,
 *           LCD1602 I2C Display, Fail-safe Safety Interlocks
 * Build:    pio run -e esp32dev (physical board) | pio run -e wokwi (Wokwi simulator)
 */

#include <Arduino.h>
#include <WiFi.h>
#include <Wire.h>
#include <math.h>
#include <LiquidCrystal_I2C.h>
#include <ModbusIP_ESP8266.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <Adafruit_BME280.h>

// Real credentials live in src/secrets.h (gitignored; copy secrets.example.h).
#if __has_include("secrets.h")
#include "secrets.h"
#else
#define WIFI_SSID     "Wokwi-GUEST"
#define WIFI_PASSWORD ""
#endif

// --- PIN ASSIGNMENTS (Synchronized with HARDWARE_PINS and TRACKER.md) ---
#define PIN_LED_GREEN    23   // Green Normal Operation Status LED
#define PIN_LED_RED      13   // Red Critical Alarm Trip LED
#define PIN_RELAY_PUMP   26   // Inflow Submersible Pump Relay (Driver IN)
#define PIN_VALVE_DRIVER 27   // Emergency Drain Valve Relay (Driver IN)
#define PIN_FAN_DRIVER   14   // Toxic Gas Exhaust Safety Fan (Driver IN)

#define PIN_US_TRIG      25   // HC-SR04 Ultrasonic Trigger Pulse (Output)
#define PIN_US_ECHO      34   // HC-SR04 Ultrasonic Echo Pulse (Input via 5V->3.0V Divider)
#define PIN_ONEWIRE_TEMP  4   // DS18B20 1-Wire Bus (with 4.7kΩ Pull-up)
#define PIN_ADC_GAS      32   // MQ-2 Gas Sensor Analog Output via 15k/15k divider (ADC1_CH4)
#define PIN_ADC_CURRENT  33   // ACS712-05B Current Sensor Output (ADC1_CH5)
#define PIN_ADC_SUPPLY   35   // 0-25V Voltage Sensor Module S pin (ADC1_CH7)

// --- MODBUS REGISTERS & COILS SPECIFICATION ---
// Protocol Offset 0-based mapping to Standard 4xxxx / 0xxxx PLC Addresses.
// Signed values are int16 two's complement: read them as I16 in LabVIEW.
const int REG_OFFSET_TANK_LEVEL   = 0; // 40001: Tank Level (x10 %)
const int REG_OFFSET_TEMPERATURE  = 1; // 40002: Process Temperature (x10 °C, I16)
const int REG_OFFSET_GAS_PPM      = 2; // 40003: Gas Concentration (PPM, LPG curve)
const int REG_OFFSET_CURRENT      = 3; // 40004: Motor Current (x100 A)
const int REG_OFFSET_AMBIENT_TEMP = 4; // 40005: BME280 Ambient Temperature (x10 °C, I16)
const int REG_OFFSET_HUMIDITY     = 5; // 40006: BME280 Relative Humidity (x10 %)
const int REG_OFFSET_PRESSURE     = 6; // 40007: BME280 Pressure (x10 hPa)
const int REG_OFFSET_SUPPLY_V     = 7; // 40008: Supply Voltage (x100 V)
const int REG_OFFSET_GAS_MV       = 8; // 40009: MQ-2 AO at the sensor (mV), for calibration
const int REG_COUNT               = 9;
// Written instead of a reading when its sensor is faulty, missing or warming up.
// 32767 is out of every engineering range for both U16 and I16 reads, so the bridge rejects it.
const uint16_t REG_SENSOR_FAULT   = 0x7FFF;

const int COIL_OFFSET_PUMP        = 0; // 00001: Pump Relay State
const int COIL_OFFSET_VALVE       = 1; // 00002: Valve Relay State
const int COIL_OFFSET_FAN         = 2; // 00003: Exhaust Fan State

// --- SENSOR CALIBRATION (measure these on your own rig) ---
const float TANK_DEPTH_CM        = 100.0f;  // Sensor face to empty-tank bottom
const int   ADC_SAMPLES          = 16;      // Averaged per analog reading

const float ACS712_MV_PER_A      = 185.0f;  // ACS712-05B sensitivity at 5V supply
const float ACS712_DIVIDER_RATIO = 1.0f;    // Set to (R1+R2)/R2 if a divider is added on OUT
const float ACS712_MIN_SENSOR_MV = 1500.0f; // Below this the 2.5V-centred output is disconnected

const float SUPPLY_DIVIDER_RATIO = 5.0f;    // 0-25V module is a 30k/7.5k divider

const float MQ2_DIVIDER_RATIO    = 2.0f;    // 15k/15k divider halves AO into the ADC
const float MQ2_SUPPLY_MV        = 5000.0f;
const float MQ2_RL_KOHM          = 1.0f;    // Module load resistor: "102" = 1k, "472" = 4.7k
const float MQ2_R0_KOHM          = 10.0f;   // Clean-air R0 printed on Serial as "[MQ2] R0 estimate"
const float MQ2_LPG_A            = 574.25f; // Datasheet LPG curve: ppm = A * (Rs/R0)^B
const float MQ2_LPG_B            = -2.222f;
const unsigned long MQ2_WARMUP_MS = 120000; // Heater warm-up; gas reported as fault until done

const unsigned long DS18B20_CONVERSION_MS = 750; // 12-bit conversion time

// --- PERIPHERALS & NETWORKING ---
LiquidCrystal_I2C lcd(0x27, 16, 2);
ModbusIP mb;
OneWire oneWire(PIN_ONEWIRE_TEMP);
DallasTemperature sensors(&oneWire);
Adafruit_BME280 bme;
bool bmePresent = false;
float acs712ZeroSensorMv = 2500.0f;
float lastTemperature = DEVICE_DISCONNECTED_C;
unsigned long lastTempRequest = 0;

uint16_t encodeTenths(float value) {
  return (uint16_t)(int16_t)lroundf(value * 10.0f);
}

float readAdcMilliVolts(int pin) {
  uint32_t total = 0;
  for (int i = 0; i < ADC_SAMPLES; i++) total += analogReadMilliVolts(pin);
  return (float)total / ADC_SAMPLES;
}

uint8_t readI2cChipId(uint8_t address) {
  Wire.beginTransmission(address);
  Wire.write(0xD0); // Bosch chip-id register
  if (Wire.endTransmission() != 0 || Wire.requestFrom(address, (uint8_t)1) != 1) return 0;
  return Wire.read();
}

void setupBme280() {
  for (uint8_t address : {0x76, 0x77}) {
    if (bme.begin(address, &Wire)) {
      bmePresent = true;
      Serial.printf("[BME280] Found at 0x%02X\\n", address);
      return;
    }
    uint8_t chipId = readI2cChipId(address);
    if (chipId == 0x58) {
      Serial.printf("[BME280] 0x%02X is a BMP280 (no humidity); ambient registers report fault\\n", address);
      return;
    }
  }
  Serial.println("[BME280] Not found; ambient registers report fault");
}

// Zero-current offset, measured with the pump relay open before anything is energised.
void calibrateAcs712() {
#ifndef WOKWI_SIM
  float sensorMv = 0.0f;
  for (int i = 0; i < 8; i++) sensorMv += readAdcMilliVolts(PIN_ADC_CURRENT) * ACS712_DIVIDER_RATIO;
  sensorMv /= 8;
  if (sensorMv > 2200.0f && sensorMv < 2800.0f) {
    acs712ZeroSensorMv = sensorMv;
    Serial.printf("[ACS712] Zero offset %.0f mV\\n", sensorMv);
  } else {
    Serial.printf("[ACS712] Zero offset %.0f mV implausible; using nominal 2500 mV\\n", sensorMv);
  }
#endif
}

// Returns amps, or NAN when the sensor is disconnected.
float readMotorAmps() {
  float pinMv = readAdcMilliVolts(PIN_ADC_CURRENT);
#ifdef WOKWI_SIM
  return constrain(pinMv / 3300.0f * 5.0f, 0.0f, 5.0f); // Potentiometer stand-in
#else
  float sensorMv = pinMv * ACS712_DIVIDER_RATIO;
  if (sensorMv < ACS712_MIN_SENSOR_MV) return NAN;
  return constrain((sensorMv - acs712ZeroSensorMv) / ACS712_MV_PER_A, 0.0f, 5.0f);
#endif
}

// Returns PPM, or NAN while the heater is still warming up.
float readGasPpm(float sensorMv) {
#ifdef WOKWI_SIM
  return constrain(sensorMv / MQ2_DIVIDER_RATIO / 3300.0f * 1000.0f, 0.0f, 1000.0f);
#else
  if (millis() < MQ2_WARMUP_MS) return NAN;
  if (sensorMv <= 1.0f) return 0.0f;
  if (sensorMv >= MQ2_SUPPLY_MV) return 1000.0f;
  float rsKohm = MQ2_RL_KOHM * (MQ2_SUPPLY_MV - sensorMv) / sensorMv;
  return constrain(MQ2_LPG_A * powf(rsKohm / MQ2_R0_KOHM, MQ2_LPG_B), 0.0f, 1000.0f);
#endif
}

void printMq2Calibration(float sensorMv) {
  static unsigned long lastPrint = 0;
  if (millis() - lastPrint < 10000 || sensorMv <= 1.0f) return;
  lastPrint = millis();
  float rsKohm = MQ2_RL_KOHM * (MQ2_SUPPLY_MV - sensorMv) / sensorMv;
  // Rs/R0 is 9.83 in clean air (datasheet); copy this into MQ2_R0_KOHM after warm-up.
  Serial.printf("[MQ2] AO %.0f mV | Rs %.2f kOhm | R0 estimate (clean air) %.2f kOhm\\n",
                sensorMv, rsKohm, rsKohm / 9.83f);
}

// Returns level %, or NAN when the echo times out.
float readTankLevel() {
  digitalWrite(PIN_US_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_US_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_US_TRIG, LOW);
  long echoDuration = pulseIn(PIN_US_ECHO, HIGH, 30000); // 30ms timeout
  if (echoDuration <= 0) return NAN;
  float distanceCm = (echoDuration * 0.0343f) / 2.0f;
  return constrain(((TANK_DEPTH_CM - distanceCm) / TANK_DEPTH_CM) * 100.0f, 0.0f, 100.0f);
}

// Non-blocking DS18B20: keeps the last reading while the next conversion runs.
float readTemperature() {
  if (millis() - lastTempRequest >= DS18B20_CONVERSION_MS) {
    lastTemperature = sensors.getTempCByIndex(0);
    sensors.requestTemperatures();
    lastTempRequest = millis();
  }
  return lastTemperature;
}

void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("\\n[BOOT] ESP32 SCADA Node starting up...");

  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_RELAY_PUMP, OUTPUT);
  pinMode(PIN_VALVE_DRIVER, OUTPUT);
  pinMode(PIN_FAN_DRIVER, OUTPUT);
  pinMode(PIN_US_TRIG, OUTPUT);
  pinMode(PIN_US_ECHO, INPUT);

  // Everything de-energised until sensors are calibrated.
  digitalWrite(PIN_US_TRIG, LOW);
  digitalWrite(PIN_RELAY_PUMP, LOW);
  digitalWrite(PIN_VALVE_DRIVER, LOW);
  digitalWrite(PIN_FAN_DRIVER, LOW);
  digitalWrite(PIN_LED_GREEN, LOW);
  digitalWrite(PIN_LED_RED, HIGH);
  analogSetAttenuation(ADC_11db);

  // Initialize Dallas 1-Wire Temperature (non-blocking conversions)
  sensors.begin();
  sensors.setWaitForConversion(false);
  sensors.requestTemperatures();
  lastTempRequest = millis();

  // Initialize I2C bus: LCD + BME280
  Wire.begin(21, 22); // SDA=21, SCL=22
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("SCADA NODE INIT");
  lcd.setCursor(0, 1);
  lcd.print("WiFi Connecting..");
  setupBme280();
  calibrateAcs712();

  // Connect to Plant Wi-Fi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 20) {
    delay(250);
    Serial.print(".");
    retries++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\\n[WIFI] Connected! IP: %s\\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\\n[WIFI] Not connected; Modbus unreachable until Wi-Fi recovers");
  }

  // Setup Modbus TCP Server
  mb.server();
  for (int reg = 0; reg < REG_COUNT; reg++) mb.addHreg(reg, REG_SENSOR_FAULT);
  mb.addCoil(COIL_OFFSET_PUMP, true);
  mb.addCoil(COIL_OFFSET_VALVE, false);
  mb.addCoil(COIL_OFFSET_FAN, false);

  Serial.println("[MODBUS] Modbus TCP Server Ready on Port 502 (Slave ID: 1)");
}

void loop() {
  // Service Modbus TCP Requests
  mb.task();

  // 1. Acquire process sensors (NAN = faulty / missing / warming up)
  float tankLevel = readTankLevel();
  float temperature = readTemperature();
  bool tempSensorFault = (temperature == DEVICE_DISCONNECTED_C || temperature < -55.0f);
  float gasSensorMv = readAdcMilliVolts(PIN_ADC_GAS) * MQ2_DIVIDER_RATIO;
  float gasPpm = readGasPpm(gasSensorMv);
  float motorAmps = readMotorAmps();
  float supplyVolts = readAdcMilliVolts(PIN_ADC_SUPPLY) * SUPPLY_DIVIDER_RATIO / 1000.0f;
  printMq2Calibration(gasSensorMv);

  bool levelFault = isnan(tankLevel);
  bool gasFault = isnan(gasPpm);
  bool currentFault = isnan(motorAmps);
  bool sensorFault = levelFault || tempSensorFault || gasFault || currentFault;

  // Supervisory & Master Safety Policy
  bool pumpState = mb.Coil(COIL_OFFSET_PUMP);
  bool valveState = mb.Coil(COIL_OFFSET_VALVE);
  bool fanState = mb.Coil(COIL_OFFSET_FAN);

  // Check Critical Alarm Conditions (a faulty sensor never raises or clears its own alarm)
  bool highLevelAlarm = (!levelFault && tankLevel >= 88.0f);
  bool lowLevelAlarm = (!levelFault && tankLevel <= 25.0f);
  bool highGasAlarm = (!gasFault && gasPpm >= 250.0f);
  bool fanTrigger = (!gasFault && gasPpm > 80.0f);
  bool overTempAlarm = (!tempSensorFault && temperature >= 70.0f);
  bool overCurrentAlarm = (!currentFault && motorAmps >= 3.8f);

  bool masterTrip = highLevelAlarm || highGasAlarm || overTempAlarm || overCurrentAlarm;

  if (masterTrip) {
    // Interlock: Emergency shutdown of feed pump
    pumpState = false;
    if (highLevelAlarm) {
      valveState = true; // Open relief drain
    }
    digitalWrite(PIN_LED_GREEN, LOW);
    digitalWrite(PIN_LED_RED, (millis() / 250) % 2); // Fast Red strobe
  } else if (sensorFault) {
    // Fail-safe: never run the pump blind, ventilate while gas is unknown.
    pumpState = false;
    if (gasFault) fanState = true;
    digitalWrite(PIN_LED_GREEN, LOW);
    digitalWrite(PIN_LED_RED, HIGH); // Solid red = sensor fault
  } else {
    digitalWrite(PIN_LED_GREEN, HIGH);
    digitalWrite(PIN_LED_RED, LOW);
    if (lowLevelAlarm) {
      pumpState = true;
      valveState = false;
    }
  }

  // Exhaust Fan Control
  if (fanTrigger) {
    fanState = true;
  } else if (!gasFault && gasPpm < 45.0f) {
    fanState = false;
  }

  // Write Physical Outputs
  digitalWrite(PIN_RELAY_PUMP, pumpState ? HIGH : LOW);
  digitalWrite(PIN_VALVE_DRIVER, valveState ? HIGH : LOW);
  digitalWrite(PIN_FAN_DRIVER, fanState ? HIGH : LOW);

  // Update Modbus Registers & Coils
  mb.Hreg(REG_OFFSET_TANK_LEVEL, levelFault ? REG_SENSOR_FAULT : (uint16_t)lroundf(tankLevel * 10));
  mb.Hreg(REG_OFFSET_TEMPERATURE, tempSensorFault ? REG_SENSOR_FAULT : encodeTenths(temperature));
  mb.Hreg(REG_OFFSET_GAS_PPM, gasFault ? REG_SENSOR_FAULT : (uint16_t)lroundf(gasPpm));
  mb.Hreg(REG_OFFSET_CURRENT, currentFault ? REG_SENSOR_FAULT : (uint16_t)lroundf(motorAmps * 100));
  if (bmePresent) {
    mb.Hreg(REG_OFFSET_AMBIENT_TEMP, encodeTenths(bme.readTemperature()));
    mb.Hreg(REG_OFFSET_HUMIDITY, (uint16_t)lroundf(bme.readHumidity() * 10));
    mb.Hreg(REG_OFFSET_PRESSURE, (uint16_t)lroundf(bme.readPressure() / 10.0f)); // Pa -> x10 hPa
  }
  mb.Hreg(REG_OFFSET_SUPPLY_V, (uint16_t)lroundf(supplyVolts * 100));
  mb.Hreg(REG_OFFSET_GAS_MV, (uint16_t)lroundf(gasSensorMv));
  mb.Coil(COIL_OFFSET_PUMP, pumpState);
  mb.Coil(COIL_OFFSET_VALVE, valveState);
  mb.Coil(COIL_OFFSET_FAN, fanState);

  // Update 16x2 I2C LCD Display (500ms refresh rate)
  static unsigned long lastDisplay = 0;
  if (millis() - lastDisplay > 500) {
    lastDisplay = millis();
    lcd.setCursor(0, 0);
    if (levelFault) {
      lcd.printf("L:ERR  P:%s    ", pumpState ? "ON " : "OFF");
    } else {
      lcd.printf("L:%.1f%% P:%s   ", tankLevel, pumpState ? "ON " : "OFF");
    }
    lcd.setCursor(0, 1);
    char tempText[8], gasText[10];
    if (tempSensorFault) snprintf(tempText, sizeof(tempText), "ERR");
    else snprintf(tempText, sizeof(tempText), "%.0fC", temperature);
    if (gasFault) snprintf(gasText, sizeof(gasText), "WARMUP");
    else snprintf(gasText, sizeof(gasText), "%.0fppm", gasPpm);
    lcd.printf("T:%-4s G:%-7s", tempText, gasText);
  }

  delay(50);
}
`;
