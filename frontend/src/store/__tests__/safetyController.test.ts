import { describe, it, expect } from 'vitest';
import { executeMCUControlStep, getInitialMCUState } from '../mcuSimulationEngine';
import { validateCircuitGraph } from '../circuitValidator';
import { INITIAL_COMPONENTS, SCADA_REFERENCE_WIRES } from '../workbenchStore';
import { DEVICE_DISCONNECTED_C } from '../../constants/pinMapping';
import type { LiveTelemetry } from '../../types/workbench';

const healthyReport = validateCircuitGraph(INITIAL_COMPONENTS, SCADA_REFERENCE_WIRES);

const baseTelemetry: LiveTelemetry = {
  tank_level: 45.0,
  temperature: 28.5,
  gas_ppm: 35.0,
  current_draw: 1.85,
  pump_active: true,
  valve_open: false,
  fan_active: false,
  status_class: 0,
};

describe('MCU Safety Controller & Actuator Protection', () => {
  it('returns Dallas DEVICE_DISCONNECTED_C (-127.0°C) when DS18B20 probe is disconnected', () => {
    // Generate health report with temperature sensor disconnected
    const wiresWithoutTemp = SCADA_REFERENCE_WIRES.filter(
      (w) => !(w.fromComponentId === 'ds18b20_1' || w.toComponentId === 'ds18b20_1')
    );
    const unhealthReport = validateCircuitGraph(INITIAL_COMPONENTS, wiresWithoutTemp);

    const mcuState = getInitialMCUState();
    const result = executeMCUControlStep(baseTelemetry, mcuState, 1, unhealthReport, 'auto');

    expect(result.updatedTelemetry.temperature).toBe(DEVICE_DISCONNECTED_C);
  });

  it('masks actuator output: disconnected exhaust fan never energizes on Modbus coil 3 or telemetry', () => {
    // Disconnect exhaust fan
    const wiresWithoutFan = SCADA_REFERENCE_WIRES.filter(
      (w) => !(w.fromComponentId === 'fan_1' || w.toComponentId === 'fan_1')
    );
    const reportWithoutFan = validateCircuitGraph(INITIAL_COMPONENTS, wiresWithoutFan);

    const highGasTelemetry: LiveTelemetry = {
      ...baseTelemetry,
      gas_ppm: 400.0, // High gas triggers exhaust fan logic
    };

    const mcuState = getInitialMCUState();
    const result = executeMCUControlStep(highGasTelemetry, mcuState, 1, reportWithoutFan, 'auto');

    // Actuator output must be physically masked to false
    expect(result.updatedTelemetry.fan_active).toBe(false);
    expect(result.updatedMCUState.modbusCoils[3]).toBe(false);
    expect(result.updatedMCUState.gpioStates.gpio14).toBe(false);
  });

  it('trips feed pump OFF when hazardous gas reaches critical threshold (>= 250 PPM)', () => {
    const criticalGasTelemetry: LiveTelemetry = {
      ...baseTelemetry,
      gas_ppm: 260.0,
      pump_active: true,
    };

    const mcuState = getInitialMCUState();
    const result = executeMCUControlStep(criticalGasTelemetry, mcuState, 1, healthyReport, 'auto');

    expect(result.updatedTelemetry.pump_active).toBe(false);
    expect(result.updatedMCUState.modbusCoils[1]).toBe(false);
    expect(result.updatedTelemetry.status_class).toBe(2); // Critical status
  });

  it('trips feed pump OFF when motor current exceeds safety threshold (>= 3.8A)', () => {
    const overcurrentTelemetry: LiveTelemetry = {
      ...baseTelemetry,
      current_draw: 4.2,
      pump_active: true,
    };

    const mcuState = getInitialMCUState();
    const result = executeMCUControlStep(overcurrentTelemetry, mcuState, 1, healthyReport, 'auto');

    expect(result.updatedTelemetry.pump_active).toBe(false);
    expect(result.updatedMCUState.modbusCoils[1]).toBe(false);
  });

  it('trips feed pump OFF and opens relief valve on high tank level (>= 88%)', () => {
    const highLevelTelemetry: LiveTelemetry = {
      ...baseTelemetry,
      tank_level: 92.0,
      pump_active: true,
      valve_open: false,
    };

    const mcuState = getInitialMCUState();
    const result = executeMCUControlStep(highLevelTelemetry, mcuState, 1, healthyReport, 'auto');

    expect(result.updatedTelemetry.pump_active).toBe(false);
    expect(result.updatedTelemetry.valve_open).toBe(true);
    expect(result.updatedMCUState.modbusCoils[1]).toBe(false);
    expect(result.updatedMCUState.modbusCoils[2]).toBe(true);
  });

  it('uses edge-triggered transitions to avoid flooding serial logs on repeated ticks', () => {
    const criticalGasTelemetry: LiveTelemetry = {
      ...baseTelemetry,
      gas_ppm: 300.0,
    };

    const mcuState = getInitialMCUState();

    // Step 1: Transition into critical alarm
    const step1 = executeMCUControlStep(criticalGasTelemetry, mcuState, 1, healthyReport, 'auto');
    const step1AlarmLogs = step1.newLogs.filter((l) => l.level === 'ALARM');
    expect(step1AlarmLogs.length).toBeGreaterThan(0);

    // Step 2: Continuous tick with the same critical condition
    const step2 = executeMCUControlStep(
      step1.updatedTelemetry,
      step1.updatedMCUState,
      10,
      healthyReport,
      'auto'
    );
    const step2AlarmLogs = step2.newLogs.filter(
      (l) => l.level === 'ALARM' && l.message.includes('TRIP: Hazardous Gas')
    );
    // Should NOT re-emit the same alarm log because it is edge-triggered
    expect(step2AlarmLogs.length).toBe(0);
  });
});
