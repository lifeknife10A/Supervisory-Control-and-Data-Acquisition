import React, { useEffect } from 'react';
import {
  X,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Sparkles,
} from 'lucide-react';
import { useWorkbenchStore } from '../../store/workbenchStore';

export const CircuitHealthModal: React.FC = () => {
  const isCircuitHealthModalOpen = useWorkbenchStore((s) => s.isCircuitHealthModalOpen);
  const setCircuitHealthModalOpen = useWorkbenchStore((s) => s.setCircuitHealthModalOpen);
  const circuitHealth = useWorkbenchStore((s) => s.circuitHealth);
  const loadReferenceWiring = useWorkbenchStore((s) => s.loadReferenceWiring);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isCircuitHealthModalOpen) {
        e.preventDefault();
        e.stopPropagation();
        setCircuitHealthModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCircuitHealthModalOpen, setCircuitHealthModalOpen]);

  if (!isCircuitHealthModalOpen) return null;

  const { devices, faults, validPathsCount, totalRequiredPaths, healthPercentage, isHealthy } = circuitHealth;

  const deviceList = [
    {
      name: 'ESP32 DevKit V1 Board',
      role: 'Master MCU & SCADA Node',
      health: devices.esp32,
      pins: 'VIN (5V), 3V3 (3.3V), GND (Ground)',
    },
    {
      name: 'HC-SR04 Level Sensor',
      role: 'Tank Hydrostatic Level (0-100%)',
      health: devices.tankLevelSensor,
      pins: 'VCC (5V), GND, TRIG (GPIO 25), ECHO (GPIO 34 via Divider)',
    },
    {
      name: 'DS18B20 Temp Probe',
      role: 'Process Reactor Temp (0-100°C)',
      health: devices.tempSensor,
      pins: 'VCC (3.3V), GND, DATA (GPIO 4) + 4.7kΩ Pull-up',
    },
    {
      name: 'MQ-2 Gas Sensor',
      role: 'Hazardous VOC / Gas (0-1000 PPM)',
      health: devices.gasSensor,
      pins: 'VCC (5V), GND, AO (GPIO 32 ADC)',
    },
    {
      name: 'ACS712 Current Board',
      role: 'Motor Current Loop (0-5.00A)',
      health: devices.currentSensor,
      pins: 'VCC (5V), GND, OUT (GPIO 33 ADC), IP+/IP- in series with Pump',
    },
    {
      name: '5V Relay & Inflow Pump',
      role: 'Inflow Control Actuator',
      health: devices.pumpActuator,
      pins: 'Relay IN (GPIO 26), COM (5V Rail), NO -> Pump VCC -> GND',
    },
    {
      name: 'Emergency Drain Valve',
      role: 'Overpressure / High Level Trip',
      health: devices.valveActuator,
      pins: 'Driver IN (GPIO 27), VCC (5V), GND Return',
    },
    {
      name: '5V Safety Exhaust Fan',
      role: 'Toxic Vapor Evacuation',
      health: devices.fanActuator,
      pins: 'Driver IN (GPIO 14), VCC (5V), GND Return',
    },
    {
      name: '16x2 I2C LCD Display',
      role: 'Local Operator HMI Screen',
      health: devices.lcdDisplay,
      pins: 'VCC (5V), GND, SDA (GPIO 21), SCL (GPIO 22)',
    },
    {
      name: 'Status & Alarm LEDs',
      role: 'Visual Optical Indicators',
      health: devices.ledGreen,
      pins: 'Green (GPIO 2 via 220Ω), Red (GPIO 12 via 220Ω), Cathodes to GND',
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="circuit-health-title"
      onClick={() => setCircuitHealthModalOpen(false)}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in-50"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/50 select-none">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-sky-500/10 text-sky-400 rounded-xl border border-sky-500/30">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 id="circuit-health-title" className="text-sm font-bold text-white tracking-tight">
                Circuit Netlist &amp; Electrical Diagnostics
              </h2>
              <p className="text-xs text-slate-400">
                Graph analysis verifying physical jumper connections from ESP32 to breadboard, sensors, and actuators.
              </p>
            </div>
          </div>
          <button
            onClick={() => setCircuitHealthModalOpen(false)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            title="Close (Esc)"
            aria-label="Close circuit diagnostics dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Health Score Banner */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                isHealthy
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : healthPercentage >= 60
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
              }`}
            >
              {healthPercentage}%
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-white">
                  {validPathsCount} of {totalRequiredPaths} Critical Electrical Paths Complete
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    isHealthy
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                      : 'bg-amber-950 text-amber-300 border-amber-700'
                  }`}
                >
                  {isHealthy ? 'CIRCUIT VERIFIED' : 'CIRCUIT INCOMPLETE'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {isHealthy
                  ? 'All sensors, actuators, power rails, and I2C buses are electrically valid.'
                  : 'Disconnected devices will read open-circuit and trip hardware safety alarms.'}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              loadReferenceWiring();
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-xs"
            title="Load fully verified industrial SCADA jumper wiring"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Auto-Wire Verified Circuit</span>
          </button>
        </div>

        {/* Modal Body: Device Checklist */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-900/60">
          {/* Fault Warnings List */}
          {faults.length > 0 && (
            <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-3.5 space-y-1.5">
              <div className="flex items-center space-x-2 text-rose-400 font-bold text-xs">
                <AlertTriangle className="w-4 h-4" />
                <span>Detected Open Circuits & Disconnects ({faults.length}):</span>
              </div>
              <ul className="text-xs text-rose-200/90 list-disc list-inside space-y-1 pl-1">
                {faults.map((f, idx) => (
                  <li key={idx}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Device Table */}
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
            <div className="divide-y divide-slate-800/80 text-xs">
              {deviceList.map((dev, idx) => {
                const isOk = dev.health.connected;
                return (
                  <div
                    key={idx}
                    className="p-3 flex items-center justify-between hover:bg-slate-900/50 transition"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="mt-0.5">
                        {isOk ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-100">{dev.name}</span>
                          <span className="text-[10px] text-slate-500">({dev.role})</span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {dev.pins}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                          isOk
                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60'
                            : 'bg-rose-950/80 text-rose-300 border-rose-800/60'
                        }`}
                      >
                        {dev.health.statusText}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <Zap className="w-3.5 h-3.5 text-sky-400" />
            <span>Simulation gating: Unconnected sensors produce 0V open-circuit readings.</span>
          </div>
          <button
            onClick={() => setCircuitHealthModalOpen(false)}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
