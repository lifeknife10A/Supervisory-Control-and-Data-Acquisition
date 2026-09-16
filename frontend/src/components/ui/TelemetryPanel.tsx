import React from 'react';
import {
  Droplets,
  Thermometer,
  Wind,
  Zap,
  Activity,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  X,
  SlidersHorizontal,
  Info
} from 'lucide-react';
import { useWorkbenchStore } from '../../store/workbenchStore';
import { DEVICE_DISCONNECTED_C } from '../../constants/pinMapping';

interface TelemetryPanelProps {
  onClose?: () => void;
}

export const TelemetryPanel: React.FC<TelemetryPanelProps> = ({ onClose }) => {
  const telemetry = useWorkbenchStore((s) => s.telemetry);
  const setTelemetry = useWorkbenchStore((s) => s.setTelemetry);
  const togglePump = useWorkbenchStore((s) => s.togglePump);
  const toggleValve = useWorkbenchStore((s) => s.toggleValve);
  const toggleFan = useWorkbenchStore((s) => s.toggleFan);
  const controlMode = useWorkbenchStore((s) => s.controlMode);
  const setControlMode = useWorkbenchStore((s) => s.setControlMode);
  const circuitHealth = useWorkbenchStore((s) => s.circuitHealth);

  const isWarning = telemetry.status_class === 1;
  const isCritical = telemetry.status_class === 2;

  const devices = circuitHealth.devices;
  const isTempDisconnected = !devices.tempSensor?.connected || telemetry.temperature <= (DEVICE_DISCONNECTED_C + 10);

  return (
    <aside
      aria-label="SCADA Telemetry Controls and Process Variables"
      className="absolute left-3 right-3 sm:right-auto sm:w-80 top-[52px] md:top-[98px] bottom-16 sm:bottom-4 max-h-[calc(100vh-8rem)] overflow-y-auto bg-white/95 backdrop-blur-md border border-gray-200 rounded-2xl shadow-xl p-4 flex flex-col space-y-3.5 z-20 text-slate-800 transition-all duration-300 scrollbar-thin scrollbar-thumb-gray-200"
    >
      {/* Header with Title & Close Button */}
      <div className="flex items-center justify-between pb-1 border-b border-gray-100">
        <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800">
          <Activity className="w-4 h-4 text-sky-600" />
          <span>SCADA Telemetry Controls</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
            title="Close panel"
            aria-label="Close telemetry panel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Control Mode Banner */}
      <div className="flex items-center justify-between bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs">
        <div className="flex items-center space-x-1.5">
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" />
          <span className="font-semibold text-slate-700">Mode:</span>
          <span
            className={`font-bold px-2 py-0.5 rounded text-[11px] ${
              controlMode === 'auto'
                ? 'bg-sky-100 text-sky-800'
                : controlMode === 'manual'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-rose-100 text-rose-800'
            }`}
          >
            {controlMode === 'auto' ? 'Auto Closed-Loop' : controlMode === 'manual' ? 'Manual Override' : 'Fault Injection'}
          </span>
        </div>
        {controlMode === 'auto' ? (
          <button
            onClick={() => setControlMode('manual')}
            className="text-[10px] text-sky-600 hover:text-sky-800 font-bold underline"
            title="Switch to manual override mode"
          >
            Override
          </button>
        ) : (
          <button
            onClick={() => setControlMode('auto')}
            className="text-[10px] text-sky-600 hover:text-sky-800 font-bold underline"
            title="Return to auto closed-loop mode"
          >
            Auto
          </button>
        )}
      </div>

      {/* AI System Health Banner */}
      <div
        className={`p-3 rounded-xl border flex items-center space-x-3 transition ${
          isCritical
            ? 'bg-rose-50 border-rose-200 text-rose-800'
            : isWarning
            ? 'bg-amber-50 border-amber-200 text-amber-800'
            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}
      >
        <div className="p-2 rounded-lg bg-white shadow-xs">
          {isCritical ? (
            <ShieldAlert className="w-5 h-5 text-rose-600" />
          ) : isWarning ? (
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          ) : (
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          )}
        </div>
        <div>
          <div className="text-xs font-black uppercase tracking-wider">
            {isCritical ? 'CRITICAL SAFETY TRIP' : isWarning ? 'WARNING / DRIFT' : 'HEALTHY STATE'}
          </div>
          <p className="text-[10px] text-gray-500 m-0">
            {isCritical
              ? 'Safety thresholds exceeded'
              : isWarning
              ? 'Elevated metrics detected'
              : 'All variables within bounds'}
          </p>
        </div>
      </div>

      {/* 4 Process Variables (Telemetry Sliders) */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider m-0 flex items-center justify-between">
          <span>Process Variables</span>
          <Activity className="w-3.5 h-3.5 text-sky-600" />
        </h3>

        {/* 1. Tank Level (Modbus 40001) */}
        <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-200 space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="slider-tank-level" className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5 cursor-pointer">
              <Droplets className="w-3.5 h-3.5 text-sky-600" />
              <span>Tank Level (40001)</span>
            </label>
            <div className="flex items-center space-x-1.5">
              {!devices.tankLevelSensor?.connected && (
                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200" title="Ultrasonic sensor not wired to ESP32 TRIG (GPIO 25) / ECHO (GPIO 34)">
                  NO WIRE
                </span>
              )}
              <span className="text-xs font-mono font-bold text-sky-600">
                {telemetry.tank_level.toFixed(1)}%
              </span>
            </div>
          </div>
          <input
            id="slider-tank-level"
            type="range"
            min="0"
            max="100"
            step="0.5"
            aria-label="Tank Level percentage"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={telemetry.tank_level}
            aria-valuetext={`${telemetry.tank_level.toFixed(1)} percent`}
            value={telemetry.tank_level}
            onChange={(e) => setTelemetry({ tank_level: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
          />
        </div>

        {/* 2. Reactor Temperature (Modbus 40002) */}
        <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-200 space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="slider-temperature" className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5 cursor-pointer">
              <Thermometer className="w-3.5 h-3.5 text-orange-500" />
              <span>Temperature (40002)</span>
            </label>
            <div className="flex items-center space-x-1.5">
              {isTempDisconnected ? (
                <>
                  <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200" title="DS18B20 1-Wire Open Circuit (DEVICE_DISCONNECTED_C = -127°C)">
                    OPEN BUS
                  </span>
                  <span className="text-xs font-mono font-bold text-rose-600">
                    -127.0°C
                  </span>
                </>
              ) : (
                <span className="text-xs font-mono font-bold text-orange-600">
                  {telemetry.temperature.toFixed(1)}°C
                </span>
              )}
            </div>
          </div>
          <input
            id="slider-temperature"
            type="range"
            min="0"
            max="100"
            step="0.5"
            aria-label="Reactor Temperature in Celsius"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.max(0, telemetry.temperature)}
            aria-valuetext={`${telemetry.temperature.toFixed(1)} degrees Celsius`}
            value={Math.max(0, telemetry.temperature)}
            disabled={!devices.tempSensor?.connected}
            onChange={(e) => setTelemetry({ temperature: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500 disabled:opacity-40 disabled:cursor-not-allowed"
          />
        </div>

        {/* 3. Hazardous Gas PPM (Modbus 40003) */}
        <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-200 space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="slider-gas-ppm" className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5 cursor-pointer">
              <Wind className="w-3.5 h-3.5 text-purple-600" />
              <span>Gas PPM (40003)</span>
            </label>
            <div className="flex items-center space-x-1.5">
              {!devices.gasSensor?.connected && (
                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200" title="MQ-2 Gas sensor not wired to GPIO 32">
                  NO WIRE
                </span>
              )}
              <span className="text-xs font-mono font-bold text-purple-600">
                {telemetry.gas_ppm.toFixed(0)} PPM
              </span>
            </div>
          </div>
          <input
            id="slider-gas-ppm"
            type="range"
            min="0"
            max="1000"
            step="5"
            aria-label="Hazardous Gas Parts Per Million"
            aria-valuemin={0}
            aria-valuemax={1000}
            aria-valuenow={telemetry.gas_ppm}
            aria-valuetext={`${telemetry.gas_ppm.toFixed(0)} PPM`}
            value={telemetry.gas_ppm}
            onChange={(e) => setTelemetry({ gas_ppm: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
          />
        </div>

        {/* 4. Motor Current (Modbus 40004) */}
        <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-200 space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="slider-current-draw" className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5 cursor-pointer">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Current Draw (40004)</span>
            </label>
            <div className="flex items-center space-x-1.5">
              {!devices.currentSensor?.connected && (
                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200" title="ACS712 Current sensor not wired to GPIO 33">
                  NO WIRE
                </span>
              )}
              <span className="text-xs font-mono font-bold text-amber-600">
                {telemetry.current_draw.toFixed(2)} A
              </span>
            </div>
          </div>
          <input
            id="slider-current-draw"
            type="range"
            min="0"
            max="5"
            step="0.05"
            aria-label="Motor Current Draw in Amperes"
            aria-valuemin={0}
            aria-valuemax={5}
            aria-valuenow={telemetry.current_draw}
            aria-valuetext={`${telemetry.current_draw.toFixed(2)} Amperes`}
            value={telemetry.current_draw}
            onChange={(e) => setTelemetry({ current_draw: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
        </div>
      </div>

      {/* Actuator Toggles */}
      <div className="space-y-2 pt-2 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider m-0">
            Actuators (3D Live)
          </h3>
          {controlMode === 'auto' && (
            <span className="text-[10px] text-slate-400 flex items-center space-x-1" title="MCU auto-controls actuators based on sensor levels">
              <Info className="w-3 h-3" />
              <span>Auto-Managed</span>
            </span>
          )}
        </div>

        {/* Pump Relay Toggle */}
        <div className="flex items-center justify-between bg-gray-50 p-2 rounded-xl border border-gray-200">
          <div className="flex items-center space-x-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                telemetry.pump_active ? 'bg-emerald-500 shadow-xs' : 'bg-gray-300'
              }`}
            />
            <div>
              <span className="text-xs font-semibold text-slate-700 block">Feed Pump (GPIO 26 / Coil 00001)</span>
              {!devices.pumpActuator?.connected && (
                <span className="text-[9px] text-rose-500 block font-medium">Relay / pump circuit open</span>
              )}
            </div>
          </div>
          <button
            onClick={() => {
              if (controlMode === 'auto') setControlMode('manual');
              togglePump();
            }}
            aria-label={`Toggle feed pump. Current state: ${telemetry.pump_active ? 'ON' : 'OFF'}`}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
              telemetry.pump_active
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
          >
            {telemetry.pump_active ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Valve Relay Toggle */}
        <div className="flex items-center justify-between bg-gray-50 p-2 rounded-xl border border-gray-200">
          <div className="flex items-center space-x-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                telemetry.valve_open ? 'bg-rose-500 shadow-xs' : 'bg-gray-300'
              }`}
            />
            <div>
              <span className="text-xs font-semibold text-slate-700 block">Safety Valve (GPIO 27 / Coil 00002)</span>
              {!devices.valveActuator?.connected && (
                <span className="text-[9px] text-rose-500 block font-medium">Valve circuit open</span>
              )}
            </div>
          </div>
          <button
            onClick={() => {
              if (controlMode === 'auto') setControlMode('manual');
              toggleValve();
            }}
            aria-label={`Toggle safety valve. Current state: ${telemetry.valve_open ? 'OPEN' : 'CLOSED'}`}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
              telemetry.valve_open
                ? 'bg-rose-600 text-white'
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
          >
            {telemetry.valve_open ? 'OPEN' : 'CLOSED'}
          </button>
        </div>

        {/* Exhaust Fan Toggle */}
        <div className="flex items-center justify-between bg-gray-50 p-2 rounded-xl border border-gray-200">
          <div className="flex items-center space-x-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                telemetry.fan_active ? 'bg-sky-500 shadow-xs' : 'bg-gray-300'
              }`}
            />
            <div>
              <span className="text-xs font-semibold text-slate-700 block">Exhaust Fan (GPIO 14 / Coil 00003)</span>
              {!devices.fanActuator?.connected && (
                <span className="text-[9px] text-rose-500 block font-medium">Fan disconnected</span>
              )}
            </div>
          </div>
          <button
            onClick={() => {
              if (controlMode === 'auto') setControlMode('manual');
              toggleFan();
            }}
            aria-label={`Toggle exhaust fan. Current state: ${telemetry.fan_active ? 'SPINNING' : 'STOPPED'}`}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
              telemetry.fan_active
                ? 'bg-sky-600 text-white'
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
          >
            {telemetry.fan_active ? 'SPIN' : 'STOP'}
          </button>
        </div>
      </div>
    </aside>
  );
};
