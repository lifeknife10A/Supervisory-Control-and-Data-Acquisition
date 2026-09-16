import React from 'react';
import {
  Zap,
  Droplet,
  Activity,
  AlertTriangle,
  X,
  Gauge,
  Wind,
  Power,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useWorkbenchStore } from '../../store/workbenchStore';

export const CircuitSimulationDashboard: React.FC<{ onClose?: () => void }> = ({
  onClose,
}) => {
  const wires = useWorkbenchStore((s) => s.wires);
  const telemetry = useWorkbenchStore((s) => s.telemetry);
  const circuitHealth = useWorkbenchStore((s) => s.circuitHealth);

  const isHealthy = circuitHealth.isHealthy;
  const totalPower = telemetry.current_draw * 5; // Approximate power at 5V

  return (
    <div className="fixed left-3 right-3 sm:left-3 sm:right-auto sm:w-96 top-[52px] sm:top-[98px] md:top-auto md:bottom-4 md:right-3 md:left-auto max-h-[calc(100vh-120px)] sm:max-h-[calc(100vh-8rem)] overflow-y-auto bg-white/95 backdrop-blur-md border border-gray-200 rounded-2xl shadow-xl p-4 z-20 flex flex-col space-y-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-gray-100">
        <div className="flex items-center space-x-1.5">
          <Zap className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-bold text-slate-800">Circuit Simulation</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Status Indicator */}
      <div
        className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-semibold ${
          isHealthy
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            : 'bg-amber-50 text-amber-800 border border-amber-200'
        }`}
      >
        {isHealthy ? (
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
        ) : (
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
        )}
        <span>
          {isHealthy ? 'Circuit Healthy' : 'Circuit Issues Detected'}
        </span>
      </div>

      {/* Power Metrics */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gradient-to-br from-sky-50 to-sky-100 border border-sky-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-sky-700 uppercase">Voltage</span>
            <Gauge className="w-3.5 h-3.5 text-sky-600" />
          </div>
          <div className="text-lg font-bold text-sky-900">{telemetry.current_draw.toFixed(2)}A</div>
          <div className="text-[10px] text-sky-600">System Load</div>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-amber-700 uppercase">Power</span>
            <Power className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-lg font-bold text-amber-900">{totalPower.toFixed(1)}W</div>
          <div className="text-[10px] text-amber-600">Total Consumption</div>
        </div>
      </div>

      {/* Process Telemetry */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-slate-700 uppercase">Process Variables</h3>

        <div className="space-y-1.5">
          {/* Tank Level */}
          <div className="flex items-center space-x-2">
            <Droplet className="w-3.5 h-3.5 text-blue-500" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold text-slate-700">Tank Level</div>
              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-0.5">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${telemetry.tank_level}%` }}
                />
              </div>
            </div>
            <span className="text-[10px] font-mono text-slate-600 w-12 text-right">
              {telemetry.tank_level.toFixed(1)}%
            </span>
          </div>

          {/* Temperature */}
          <div className="flex items-center space-x-2">
            <svg className="w-3.5 h-3.5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2s2-.9 2-2V4c0-1.1-.9-2-2-2zm0-2c2.2 0 4 1.8 4 4v10c0 2.2-1.8 4-4 4s-4-1.8-4-4V4c0-2.2 1.8-4 4-4z" />
            </svg>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold text-slate-700">Reactor Temp</div>
              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-0.5">
                <div
                  className="bg-red-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${Math.min(telemetry.temperature, 100)}%` }}
                />
              </div>
            </div>
            <span className="text-[10px] font-mono text-slate-600 w-12 text-right">
              {telemetry.temperature.toFixed(1)}°C
            </span>
          </div>

          {/* Gas PPM */}
          <div className="flex items-center space-x-2">
            <Wind className="w-3.5 h-3.5 text-purple-500" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold text-slate-700">Gas Sensor</div>
              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-0.5">
                <div
                  className="bg-purple-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${Math.min(telemetry.gas_ppm / 10, 100)}%` }}
                />
              </div>
            </div>
            <span className="text-[10px] font-mono text-slate-600 w-12 text-right">
              {telemetry.gas_ppm.toFixed(0)}PPM
            </span>
          </div>
        </div>
      </div>

      {/* Active Components */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-slate-700 uppercase">Actuators</h3>
        <div className="grid grid-cols-3 gap-2">
          <button
            className={`flex flex-col items-center space-y-1 px-2 py-2 rounded-lg text-[10px] font-semibold transition ${
              telemetry.pump_active
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'bg-gray-100 text-gray-600 border border-gray-200'
            }`}
            title="Inflow Pump Status"
          >
            <Droplet className="w-4 h-4" />
            <span>Pump</span>
            <span
              className={`text-[9px] font-mono ${
                telemetry.pump_active ? 'text-emerald-600' : 'text-gray-500'
              }`}
            >
              {telemetry.pump_active ? 'ON' : 'OFF'}
            </span>
          </button>

          <button
            className={`flex flex-col items-center space-y-1 px-2 py-2 rounded-lg text-[10px] font-semibold transition ${
              telemetry.valve_open
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-gray-100 text-gray-600 border border-gray-200'
            }`}
            title="Emergency Drain Valve Status"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5z" />
            </svg>
            <span>Valve</span>
            <span
              className={`text-[9px] font-mono ${
                telemetry.valve_open ? 'text-amber-600' : 'text-gray-500'
              }`}
            >
              {telemetry.valve_open ? 'OPEN' : 'CLOSE'}
            </span>
          </button>

          <button
            className={`flex flex-col items-center space-y-1 px-2 py-2 rounded-lg text-[10px] font-semibold transition ${
              telemetry.fan_active
                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                : 'bg-gray-100 text-gray-600 border border-gray-200'
            }`}
            title="Exhaust Fan Status"
          >
            <Wind className="w-4 h-4" />
            <span>Fan</span>
            <span
              className={`text-[9px] font-mono ${
                telemetry.fan_active ? 'text-blue-600' : 'text-gray-500'
              }`}
            >
              {telemetry.fan_active ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>
      </div>

      {/* Circuit Nodes & Voltages */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-slate-700 uppercase">Power Rails</h3>
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-300 rounded-lg p-2 text-center">
            <div className="text-red-800 font-bold">5.0V</div>
            <div className="text-[9px] text-red-700">VIN Supply</div>
          </div>
          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border border-yellow-300 rounded-lg p-2 text-center">
            <div className="text-yellow-800 font-bold">3.3V</div>
            <div className="text-[9px] text-yellow-700">3.3V Rail</div>
          </div>
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-300 rounded-lg p-2 text-center">
            <div className="text-gray-800 font-bold">0V</div>
            <div className="text-[9px] text-gray-700">GND Common</div>
          </div>
        </div>
      </div>

      {/* Wire Count */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-slate-600" />
          <span className="text-[11px] font-semibold text-slate-700">Active Connections</span>
        </div>
        <span className="text-sm font-bold text-slate-900">{wires.length}</span>
      </div>

      {/* Circuit Health Issues */}
      {!isHealthy && circuitHealth.faults && circuitHealth.faults.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 space-y-2">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-amber-800">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Circuit Issues</span>
          </div>
          <ul className="text-[10px] text-amber-700 space-y-1">
            {circuitHealth.faults.slice(0, 3).map((issue, idx) => (
              <li key={idx} className="flex space-x-1">
                <span className="flex-shrink-0">•</span>
                <span>{issue}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
