import { describe, it, expect } from 'vitest';
import { validateCircuitGraph, REQUIRED_CIRCUIT_PATHS } from '../circuitValidator';
import { INITIAL_COMPONENTS, SCADA_REFERENCE_WIRES } from '../workbenchStore';

describe('Circuit Validator & Netlist Engine', () => {
  it('correctly reports 0 valid paths, faults, and isHealthy=false when no wires exist', () => {
    const report = validateCircuitGraph(INITIAL_COMPONENTS, []);

    expect(report.validPathsCount).toBe(0);
    expect(report.totalRequiredPaths).toBe(REQUIRED_CIRCUIT_PATHS.length);
    expect(report.healthPercentage).toBe(0);
    expect(report.isHealthy).toBe(false);
    expect(report.faults.length).toBeGreaterThan(0);
    expect(report.powerRailsOk).toBe(false);
    expect(report.devices.esp32.connected).toBe(false);
    expect(report.devices.tankLevelSensor.connected).toBe(false);
    expect(report.devices.fanActuator.connected).toBe(false);
  });

  it('validates the complete reference circuit with 100% health and isHealthy=true', () => {
    const report = validateCircuitGraph(INITIAL_COMPONENTS, SCADA_REFERENCE_WIRES);

    expect(report.validPathsCount).toBe(report.totalRequiredPaths);
    expect(report.healthPercentage).toBe(100);
    expect(report.faults).toHaveLength(0);
    expect(report.isHealthy).toBe(true);
    expect(report.powerRailsOk).toBe(true);

    // All critical devices report connected
    expect(report.devices.esp32.connected).toBe(true);
    expect(report.devices.tankLevelSensor.connected).toBe(true);
    expect(report.devices.tempSensor.connected).toBe(true);
    expect(report.devices.gasSensor.connected).toBe(true);
    expect(report.devices.currentSensor.connected).toBe(true);
    expect(report.devices.pumpActuator.connected).toBe(true);
    expect(report.devices.valveActuator.connected).toBe(true);
    expect(report.devices.fanActuator.connected).toBe(true);
    expect(report.devices.lcdDisplay.connected).toBe(true);
    expect(report.devices.ledGreen.connected).toBe(true);
    expect(report.devices.ledRed.connected).toBe(true);
  });

  it('strictly rejects "Verified" status if any single component or driver is disconnected', () => {
    // Remove the exhaust fan driver wire (GPIO 14 to fan driver IN)
    const wiresWithoutFan = SCADA_REFERENCE_WIRES.filter(
      (w) => !(w.fromComponentId === 'fan_1' || w.toComponentId === 'fan_1')
    );

    const report = validateCircuitGraph(INITIAL_COMPONENTS, wiresWithoutFan);

    // Health cannot be 100%, cannot be healthy/verified
    expect(report.isHealthy).toBe(false);
    expect(report.validPathsCount).toBeLessThan(report.totalRequiredPaths);
    expect(report.devices.fanActuator.connected).toBe(false);
    expect(report.faults.some((f) => f.toLowerCase().includes('fan'))).toBe(true);
  });

  it('detects missing DS18B20 4.7kΩ pullup resistor or data wire', () => {
    // Remove the pullup resistor component
    const compsWithoutPullup = INITIAL_COMPONENTS.filter((c) => c.id !== 'resistor_ds18b20');
    const report = validateCircuitGraph(compsWithoutPullup, SCADA_REFERENCE_WIRES);

    expect(report.isHealthy).toBe(false);
    expect(report.devices.tempSensor.connected).toBe(false);
  });
});
