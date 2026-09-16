import type { LiveTelemetry, SerialLogEntry } from '../types/workbench';
import type { CircuitHealthReport } from './circuitValidator';
import { DEVICE_DISCONNECTED_C } from '../constants/pinMapping';

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
      message: '[SCADA-CORE] Control Loop active (550ms tick). Type "help" in terminal for commands.',
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
  controlMode: 'auto' | 'manual' | 'fault_injection' = 'auto'
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
    uptimeSeconds: parseFloat((mcuState.uptimeSeconds + 0.55).toFixed(2)),
    freeHeap: Math.max(250000, mcuState.freeHeap + Math.floor((Math.random() - 0.5) * 64)),
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

  // 2. Physical Simulation Dynamics (when sensors are connected)
  const isTankConnected = !circuitHealth || circuitHealth.devices.tankLevelSensor.connected;
  const isTempConnected = !circuitHealth || circuitHealth.devices.tempSensor.connected;
  const isGasConnected = !circuitHealth || circuitHealth.devices.gasSensor.connected;
  const isCurrentConnected = !circuitHealth || circuitHealth.devices.currentSensor.connected;

  if (isTankConnected) {
    if (telemetry.pump_active) {
      telemetry.tank_level = Math.min(100, telemetry.tank_level + (0.55 + Math.random() * 0.3));
    } else {
      telemetry.tank_level = Math.max(0, telemetry.tank_level - (0.2 + Math.random() * 0.15));
    }

    if (telemetry.valve_open) {
      telemetry.tank_level = Math.max(0, telemetry.tank_level - (1.8 + Math.random() * 0.5));
    }
  }

  if (isCurrentConnected) {
    if (telemetry.pump_active) {
      if (telemetry.current_draw < 3.5) {
        telemetry.current_draw = parseFloat((1.6 + Math.random() * 0.25).toFixed(2));
      }
    } else {
      telemetry.current_draw = parseFloat((0.08 + Math.random() * 0.04).toFixed(2));
    }
  }

  if (isTempConnected && telemetry.temperature !== DEVICE_DISCONNECTED_C) {
    telemetry.temperature = parseFloat((telemetry.temperature + (Math.random() - 0.49) * 0.18).toFixed(1));
  }

  if (isGasConnected) {
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
    if (criticalSafetyTrip) {
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
    if (overCurrentTrip || highTankAlarm || criticalGasTrip || criticalDryRun) {
      desiredPump = false;
      if (highTankAlarm) desiredValve = true;
      if (criticalGasTrip) desiredFan = true;
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
 *           MQ-2 Gas ADC, ACS712 Current ADC, LCD1602 I2C Display, Safety Interlocks
 */

#include <WiFi.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <ModbusIP_ESP8266.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// --- PIN ASSIGNMENTS (Synchronized with HARDWARE_PINS) ---
#define PIN_LED_GREEN     2   // Green Normal Operation Status LED
#define PIN_LED_RED      12   // Red Critical Alarm Trip LED
#define PIN_RELAY_PUMP   26   // Inflow Submersible Pump Relay (Driver IN)
#define PIN_VALVE_DRIVER 27   // Emergency Drain Valve Relay (Driver IN)
#define PIN_FAN_DRIVER   14   // Toxic Gas Exhaust Safety Fan (Driver IN)

#define PIN_US_TRIG      25   // HC-SR04 Ultrasonic Trigger Pulse (Output)
#define PIN_US_ECHO      34   // HC-SR04 Ultrasonic Echo Pulse (Input via 5V->3.3V Divider)
#define PIN_ONEWIRE_TEMP  4   // DS18B20 1-Wire Bus (with 4.7kΩ Pull-up)
#define PIN_ADC_GAS      32   // MQ-2 Gas Sensor Analog Output (ADC1_CH4)
#define PIN_ADC_CURRENT  33   // ACS712-05B Current Sensor Output (ADC1_CH5)

// --- MODBUS REGISTERS & COILS SPECIFICATION ---
// Protocol Offset 0-based mapping to Standard 4xxxx / 0xxxx PLC Addresses:
const int REG_OFFSET_TANK_LEVEL  = 0; // 40001: Tank Level (x10 %) [Offset 0]
const int REG_OFFSET_TEMPERATURE = 1; // 40002: Temperature (x10 °C) [Offset 1]
const int REG_OFFSET_GAS_PPM     = 2; // 40003: Gas Concentration (PPM) [Offset 2]
const int REG_OFFSET_CURRENT     = 3; // 40004: Motor Current (x100 A) [Offset 3]

const int COIL_OFFSET_PUMP       = 0; // 00001: Pump Relay State [Offset 0]
const int COIL_OFFSET_VALVE      = 1; // 00002: Valve Relay State [Offset 1]
const int COIL_OFFSET_FAN        = 2; // 00003: Exhaust Fan State [Offset 2]

// --- PERIPHERALS & NETWORKING ---
LiquidCrystal_I2C lcd(0x27, 16, 2);
ModbusIP mb;
OneWire oneWire(PIN_ONEWIRE_TEMP);
DallasTemperature sensors(&oneWire);

const char* ssid     = "SCADA_VLAN_10";
const char* password = "IndustrialSecretKey#2026";
const float TANK_DEPTH_CM = 100.0f; // Max ultrasonic measurement depth

void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("\\n[BOOT] ESP32 SCADA Node starting up...");

  // Initialize GPIOs
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_RELAY_PUMP, OUTPUT);
  pinMode(PIN_VALVE_DRIVER, OUTPUT);
  pinMode(PIN_FAN_DRIVER, OUTPUT);
  pinMode(PIN_US_TRIG, OUTPUT);
  pinMode(PIN_US_ECHO, INPUT);

  digitalWrite(PIN_US_TRIG, LOW);
  digitalWrite(PIN_RELAY_PUMP, HIGH);   // Initial fill
  digitalWrite(PIN_VALVE_DRIVER, LOW);  // Valve closed
  digitalWrite(PIN_FAN_DRIVER, LOW);    // Fan off
  digitalWrite(PIN_LED_GREEN, HIGH);
  digitalWrite(PIN_LED_RED, LOW);

  // Initialize Dallas 1-Wire Temperature
  sensors.begin();

  // Initialize I2C LCD
  Wire.begin(21, 22); // SDA=21, SCL=22
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("SCADA NODE INIT");
  lcd.setCursor(0, 1);
  lcd.print("WiFi Connecting..");

  // Connect to Plant Wi-Fi
  WiFi.begin(ssid, password);
  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 20) {
    delay(250);
    Serial.print(".");
    retries++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\\n[WIFI] Connected! IP: %s\\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\\n[WIFI] Standalone Mode (AP fallback)");
  }

  // Setup Modbus TCP Server
  mb.server();
  mb.addHreg(REG_OFFSET_TANK_LEVEL);
  mb.addHreg(REG_OFFSET_TEMPERATURE);
  mb.addHreg(REG_OFFSET_GAS_PPM);
  mb.addHreg(REG_OFFSET_CURRENT);
  mb.addCoil(COIL_OFFSET_PUMP, true);
  mb.addCoil(COIL_OFFSET_VALVE, false);
  mb.addCoil(COIL_OFFSET_FAN, false);

  Serial.println("[MODBUS] Modbus TCP Server Ready on Port 502 (Slave ID: 1)");
}

void loop() {
  // Service Modbus TCP Requests
  mb.task();

  // 1. Read Ultrasonic Level Sensor (HC-SR04)
  digitalWrite(PIN_US_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_US_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_US_TRIG, LOW);
  long echoDuration = pulseIn(PIN_US_ECHO, HIGH, 30000); // 30ms timeout
  float tankLevel = 0.0f;
  if (echoDuration > 0) {
    float distanceCm = (echoDuration * 0.0343f) / 2.0f;
    tankLevel = constrain(((TANK_DEPTH_CM - distanceCm) / TANK_DEPTH_CM) * 100.0f, 0.0f, 100.0f);
  }

  // 2. Read DS18B20 Digital Temperature
  sensors.requestTemperatures();
  float temperature = sensors.getTempCByIndex(0);
  bool tempSensorFault = (temperature == -127.0f || temperature < -55.0f);

  // 3. Read Analog MQ-2 Gas Sensor (12-bit ADC: 0-4095)
  uint16_t rawGas = analogRead(PIN_ADC_GAS);
  float gasPpm = constrain((rawGas / 4095.0f) * 1000.0f, 0.0f, 1000.0f);

  // 4. Read Analog ACS712 Current Sensor (12-bit ADC: 0-4095)
  uint16_t rawCurrent = analogRead(PIN_ADC_CURRENT);
  float motorAmps = constrain((rawCurrent / 4095.0f) * 5.0f, 0.0f, 5.0f);

  // Supervisory & Master Safety Policy
  bool pumpState = mb.Coil(COIL_OFFSET_PUMP);
  bool valveState = mb.Coil(COIL_OFFSET_VALVE);
  bool fanState = mb.Coil(COIL_OFFSET_FAN);

  // Check Critical Alarm Conditions
  bool highLevelAlarm = (tankLevel >= 88.0f);
  bool lowLevelAlarm = (tankLevel <= 25.0f);
  bool highGasAlarm = (gasPpm >= 250.0f);
  bool fanTrigger = (gasPpm > 80.0f);
  bool overTempAlarm = (!tempSensorFault && temperature >= 70.0f);
  bool overCurrentAlarm = (motorAmps >= 3.8f);

  bool masterTrip = highLevelAlarm || highGasAlarm || overTempAlarm || overCurrentAlarm;

  if (masterTrip) {
    // Interlock: Emergency shutdown of feed pump
    pumpState = false;
    if (highLevelAlarm) {
      valveState = true; // Open relief drain
    }
    digitalWrite(PIN_LED_GREEN, LOW);
    digitalWrite(PIN_LED_RED, (millis() / 250) % 2); // Fast Red strobe
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
  } else if (gasPpm < 45.0f) {
    fanState = false;
  }

  // Write Physical Outputs
  digitalWrite(PIN_RELAY_PUMP, pumpState ? HIGH : LOW);
  digitalWrite(PIN_VALVE_DRIVER, valveState ? HIGH : LOW);
  digitalWrite(PIN_FAN_DRIVER, fanState ? HIGH : LOW);

  // Update Modbus Registers & Coils
  mb.Hreg(REG_OFFSET_TANK_LEVEL, (uint16_t)(tankLevel * 10));
  mb.Hreg(REG_OFFSET_TEMPERATURE, tempSensorFault ? 0 : (uint16_t)(temperature * 10));
  mb.Hreg(REG_OFFSET_GAS_PPM, (uint16_t)gasPpm);
  mb.Hreg(REG_OFFSET_CURRENT, (uint16_t)(motorAmps * 100));
  mb.Coil(COIL_OFFSET_PUMP, pumpState);
  mb.Coil(COIL_OFFSET_VALVE, valveState);
  mb.Coil(COIL_OFFSET_FAN, fanState);

  // Update 16x2 I2C LCD Display (500ms refresh rate)
  static unsigned long lastDisplay = 0;
  if (millis() - lastDisplay > 500) {
    lastDisplay = millis();
    lcd.setCursor(0, 0);
    lcd.printf("L:%.1f%% P:%s   ", tankLevel, pumpState ? "ON " : "OFF");
    lcd.setCursor(0, 1);
    if (tempSensorFault) {
      lcd.printf("T:ERR  G:%.0fppm", gasPpm);
    } else {
      lcd.printf("T:%.0fC G:%.0fppm", temperature, gasPpm);
    }
  }

  delay(50);
}
`;
