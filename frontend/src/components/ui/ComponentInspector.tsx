import React from 'react';
import {
  RotateCw,
  Trash2,
  X,
  Layers,
  Cable,
  Terminal,
  RotateCcw,
  Cpu,
  ArrowUp,
  ArrowDown,
  MoveVertical,
  SlidersHorizontal
} from 'lucide-react';
import { useWorkbenchStore } from '../../store/workbenchStore';

interface ComponentInspectorProps {
  showTelemetry?: boolean;
}

export const ComponentInspector: React.FC<ComponentInspectorProps> = ({ showTelemetry }) => {
  const selectedIds = useWorkbenchStore((s) => s.selectedComponentIds);
  const setSelectedComponentIds = useWorkbenchStore((s) => s.setSelectedComponentIds);
  const components = useWorkbenchStore((s) => s.components);
  const wires = useWorkbenchStore((s) => s.wires);
  const moveComponentsDelta = useWorkbenchStore((s) => s.moveComponentsDelta);
  const rotateAxis = useWorkbenchStore((s) => s.rotateSelectedComponentAxis);
  const setAxisAngle = useWorkbenchStore((s) => s.setSelectedComponentAxisAngle);
  const resetRotation = useWorkbenchStore((s) => s.resetSelectedComponentRotation);
  const elevateSelectedComponents = useWorkbenchStore((s) => s.elevateSelectedComponents);
  const setSelectedComponentElevation = useWorkbenchStore((s) => s.setSelectedComponentElevation);
  const transformMode = useWorkbenchStore((s) => s.transformMode);
  const setTransformMode = useWorkbenchStore((s) => s.setTransformMode);
  const removeSelectedComponents = useWorkbenchStore((s) => s.removeSelectedComponents);
  const removeComponent = useWorkbenchStore((s) => s.removeComponent);
  const mcuState = useWorkbenchStore((s) => s.mcuState);
  const rebootMCU = useWorkbenchStore((s) => s.rebootMCU);
  const isResettingMCU = useWorkbenchStore((s) => s.isResettingMCU);
  const setSerialMonitorOpen = useWorkbenchStore((s) => s.setSerialMonitorOpen);
  const circuitHealth = useWorkbenchStore((s) => s.circuitHealth);

  if (selectedIds.length === 0) return null;

  const isMulti = selectedIds.length > 1;
  const singleComp = !isMulti ? components.find((c) => c.id === selectedIds[0]) : null;

  if (!isMulti && !singleComp) return null;

  // Find wires connected to selected component(s)
  const connectedWires = wires.filter(
    (w) => selectedIds.includes(w.fromComponentId) || selectedIds.includes(w.toComponentId)
  );

  const normalizeDeg = (rad: number) => {
    let deg = Math.round((rad * 180) / Math.PI) % 360;
    if (deg < 0) deg += 360;
    return deg;
  };

  const rotXDeg = singleComp ? normalizeDeg(singleComp.rotation[0]) : 0;
  const rotYDeg = singleComp ? normalizeDeg(singleComp.rotation[1]) : 0;
  const rotZDeg = singleComp ? normalizeDeg(singleComp.rotation[2]) : 0;

  // Device health status lookup
  const getDeviceStatus = (type: string) => {
    const devs = circuitHealth.devices;
    if (type === 'esp32') {
      return circuitHealth.esp32Powered
        ? { connected: true, label: 'Powered (5V & GND Rail OK)' }
        : { connected: false, label: 'Unpowered (Missing 5V/GND)' };
    }
    if (type === 'ultrasonic_hcsr04') {
      return devs.tankLevelSensor?.connected
        ? { connected: true, label: 'VCC, GND, TRIG, ECHO Valid' }
        : { connected: false, label: 'Incomplete Netlist' };
    }
    if (type === 'temp_ds18b20') {
      return devs.tempSensor?.connected
        ? { connected: true, label: 'VCC, GND, DQ Pull-up Valid' }
        : { connected: false, label: 'Incomplete Netlist' };
    }
    if (type === 'gas_mq2') {
      return devs.gasSensor?.connected
        ? { connected: true, label: 'VCC, GND, A0 Valid' }
        : { connected: false, label: 'Incomplete Netlist' };
    }
    if (type === 'current_acs712') {
      return devs.currentSensor?.connected
        ? { connected: true, label: 'VCC, GND, OUT & IP Series Valid' }
        : { connected: false, label: 'Incomplete Netlist' };
    }
    if (type === 'relay_module') {
      return devs.pumpActuator?.connected
        ? { connected: true, label: 'VCC, GND, IN Control Valid' }
        : { connected: false, label: 'Incomplete Netlist' };
    }
    if (type === 'fan_actuator') {
      return devs.fanActuator?.connected
        ? { connected: true, label: 'GPIO 14 & GND Valid' }
        : { connected: false, label: 'Incomplete Netlist' };
    }
    if (type === 'solenoid_valve' || type === 'valve') {
      return devs.valveActuator?.connected
        ? { connected: true, label: 'GPIO 27 & GND Valid' }
        : { connected: false, label: 'Incomplete Netlist' };
    }
    if (type === 'pump_motor') {
      return devs.pumpActuator?.connected
        ? { connected: true, label: 'Power & Relay Contact Valid' }
        : { connected: false, label: 'Incomplete Netlist' };
    }
    return null;
  };

  const compStatus = singleComp ? getDeviceStatus(singleComp.type) : null;

  return (
    <div
      className={`absolute bottom-16 md:bottom-12 z-20 pointer-events-auto left-3 right-3 sm:right-auto sm:w-84 bg-white/95 backdrop-blur-md border border-gray-200 rounded-2xl shadow-2xl p-4 text-slate-800 transition-all duration-300 max-h-[70vh] overflow-y-auto ${
        showTelemetry ? 'md:left-88' : 'md:left-4'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-gray-100">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-sky-50 text-sky-600 rounded-lg border border-sky-200">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 m-0">
              {isMulti ? `${selectedIds.length} Items Selected` : singleComp?.name}
            </h3>
            <p className="text-[10px] text-gray-400 m-0">
              {isMulti ? 'Group Transformation' : 'Component Inspector'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setSelectedComponentIds([])}
          className="p-1 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition"
          title="Deselect (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Attributes & 3-Axis Orientation */}
      <div className="space-y-2 text-xs mb-3">
        {isMulti ? (
          <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-200 space-y-2">
            <span className="text-[11px] font-semibold text-gray-500">Selected components:</span>
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
              {components
                .filter((c) => selectedIds.includes(c.id))
                .map((c) => (
                  <span
                    key={c.id}
                    className="text-[10px] bg-white text-sky-700 px-2 py-0.5 rounded-md border border-gray-200 font-medium"
                  >
                    {c.name}
                  </span>
                ))}
            </div>

            {/* Quick Group Vertical Elevation */}
            <div className="pt-1 border-t border-gray-200 flex items-center space-x-1.5">
              <button
                onClick={() => elevateSelectedComponents(0.02)}
                className="flex-1 py-1.5 bg-white hover:bg-sky-50 text-sky-700 border border-sky-200 rounded-lg text-[10px] font-bold transition flex items-center justify-center space-x-1 shadow-2xs"
                title="Lift all selected components +2 cm (Shortcut: E or PageUp)"
              >
                <ArrowUp className="w-3 h-3" />
                <span>Lift All +2cm [E]</span>
              </button>
              <button
                onClick={() => elevateSelectedComponents(-0.02)}
                className="flex-1 py-1.5 bg-white hover:bg-sky-50 text-sky-700 border border-sky-200 rounded-lg text-[10px] font-bold transition flex items-center justify-center space-x-1 shadow-2xs"
                title="Lower all selected components -2 cm (Shortcut: Q or PageDown)"
              >
                <ArrowDown className="w-3 h-3" />
                <span>Lower All -2cm [Q]</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Planar [X, Z] Position & Nudge Controls */}
            <div className="bg-slate-50 p-2.5 rounded-xl border border-gray-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 flex items-center space-x-1">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Planar Position [X, Z]</span>
                </span>
                <span className="font-mono font-bold text-indigo-700 text-[11px] bg-white px-2 py-0.5 rounded-md border border-gray-200 shadow-2xs">
                  X: {singleComp?.position[0].toFixed(2)}m, Z: {singleComp?.position[2].toFixed(2)}m
                </span>
              </div>

              {/* Quick Directional Nudge Grid (Z-axis and X-axis) */}
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                {/* Z-Axis (Forward / Backward on workbench) */}
                <div className="bg-white p-1.5 rounded-lg border border-slate-200 space-y-1">
                  <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider block">
                    Z-Axis (Depth)
                  </span>
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => moveComponentsDelta(0, -0.05)}
                      className="flex-1 py-1 px-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[10px] font-bold transition flex items-center justify-center space-x-0.5 border border-blue-200"
                      title="Move -5cm along Z (Towards back of bench)"
                    >
                      <span>-5cm</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => moveComponentsDelta(0, -0.01)}
                      className="py-1 px-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[10px] font-bold transition border border-blue-200"
                      title="Move -1cm along Z"
                    >
                      -1c
                    </button>
                    <button
                      type="button"
                      onClick={() => moveComponentsDelta(0, 0.01)}
                      className="py-1 px-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[10px] font-bold transition border border-blue-200"
                      title="Move +1cm along Z"
                    >
                      +1c
                    </button>
                    <button
                      type="button"
                      onClick={() => moveComponentsDelta(0, 0.05)}
                      className="flex-1 py-1 px-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[10px] font-bold transition flex items-center justify-center space-x-0.5 border border-blue-200"
                      title="Move +5cm along Z (Towards front of bench)"
                    >
                      <span>+5cm</span>
                    </button>
                  </div>
                </div>

                {/* X-Axis (Left / Right on workbench) */}
                <div className="bg-white p-1.5 rounded-lg border border-slate-200 space-y-1">
                  <span className="text-[9px] font-bold text-red-600 uppercase tracking-wider block">
                    X-Axis (Horizontal)
                  </span>
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => moveComponentsDelta(-0.05, 0)}
                      className="flex-1 py-1 px-1 bg-red-50 hover:bg-red-100 text-red-700 rounded text-[10px] font-bold transition flex items-center justify-center space-x-0.5 border border-red-200"
                      title="Move -5cm along X (Left)"
                    >
                      <span>-5cm</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => moveComponentsDelta(-0.01, 0)}
                      className="py-1 px-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded text-[10px] font-bold transition border border-red-200"
                      title="Move -1cm along X"
                    >
                      -1c
                    </button>
                    <button
                      type="button"
                      onClick={() => moveComponentsDelta(0.01, 0)}
                      className="py-1 px-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded text-[10px] font-bold transition border border-red-200"
                      title="Move +1cm along X"
                    >
                      +1c
                    </button>
                    <button
                      type="button"
                      onClick={() => moveComponentsDelta(0.05, 0)}
                      className="flex-1 py-1 px-1 bg-red-50 hover:bg-red-100 text-red-700 rounded text-[10px] font-bold transition flex items-center justify-center space-x-0.5 border border-red-200"
                      title="Move +5cm along X (Right)"
                    >
                      <span>+5cm</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Position, Height & Terminals Row */}
            <div className="grid grid-cols-2 gap-1.5">
              <div className="bg-sky-50/70 px-2 py-1.5 rounded-xl border border-sky-200">
                <span className="text-[9px] text-sky-600 block font-semibold">Height (Lift)</span>
                <span className="font-mono text-sky-800 font-bold text-[10px]">
                  {((singleComp?.position[1] ?? 0.005) * 100).toFixed(1)} cm
                </span>
              </div>
              <div className="bg-gray-50 px-2 py-1.5 rounded-xl border border-gray-200">
                <span className="text-[9px] text-gray-400 block">Terminals</span>
                <span className="font-mono text-slate-700 font-bold text-[10px]">
                  {singleComp?.pins.length} pins
                </span>
              </div>
            </div>

            {/* Vertical Elevation / Height (Z / Y Lift) Card */}
            <div className="bg-slate-50 p-2.5 rounded-xl border border-gray-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 flex items-center space-x-1">
                  <MoveVertical className="w-3.5 h-3.5 text-sky-600" />
                  <span>Vertical Elevation (Height / Lift)</span>
                </span>
                <span className="font-mono font-bold text-sky-700 text-[11px] bg-white px-2 py-0.5 rounded-md border border-gray-200 shadow-2xs">
                  {((singleComp?.position[1] ?? 0.005) * 100).toFixed(1)} cm
                </span>
              </div>

              {/* Slider */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[9px] text-gray-400 font-medium">
                  <span>Table (0cm)</span>
                  <span>15cm</span>
                  <span>30cm</span>
                  <span>50cm</span>
                </div>
                <input
                  type="range"
                  min="0.005"
                  max="0.5"
                  step="0.005"
                  value={singleComp?.position[1] ?? 0.005}
                  onChange={(e) => setSelectedComponentElevation(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
                />
              </div>

              {/* Quick Lift / Lower / Drop Buttons */}
              <div className="grid grid-cols-4 gap-1 pt-0.5">
                <button
                  onClick={() => elevateSelectedComponents(0.02)}
                  className="py-1 px-1 bg-white hover:bg-sky-50 text-sky-700 border border-gray-200 rounded-lg text-[10px] font-bold transition flex items-center justify-center space-x-0.5 shadow-2xs"
                  title="Lift up +2 cm (Shortcut: E or PageUp)"
                >
                  <ArrowUp className="w-3 h-3 text-sky-600" />
                  <span>+2cm</span>
                  <kbd className="text-[8px] bg-sky-100 text-sky-700 px-0.5 rounded font-mono">E</kbd>
                </button>

                <button
                  onClick={() => elevateSelectedComponents(-0.02)}
                  className="py-1 px-1 bg-white hover:bg-sky-50 text-sky-700 border border-gray-200 rounded-lg text-[10px] font-bold transition flex items-center justify-center space-x-0.5 shadow-2xs"
                  title="Lower down -2 cm (Shortcut: Q or PageDown)"
                >
                  <ArrowDown className="w-3 h-3 text-sky-600" />
                  <span>-2cm</span>
                  <kbd className="text-[8px] bg-sky-100 text-sky-700 px-0.5 rounded font-mono">Q</kbd>
                </button>

                <button
                  onClick={() => setSelectedComponentElevation(0.015)}
                  className="py-1 px-1 bg-white hover:bg-sky-50 text-sky-700 border border-gray-200 rounded-lg text-[10px] font-bold transition text-center truncate shadow-2xs"
                  title="Mount atop MB-102 Breadboard (+1.5 cm)"
                >
                  Breadboard
                </button>

                <button
                  onClick={() => setSelectedComponentElevation(0.005)}
                  className="py-1 px-1 bg-white hover:bg-gray-100 text-slate-700 border border-gray-200 rounded-lg text-[10px] font-bold transition flex items-center justify-center space-x-0.5 shadow-2xs"
                  title="Drop component flat to table surface (Shortcut: 0)"
                >
                  <span>Drop</span>
                  <kbd className="text-[8px] bg-gray-100 text-gray-600 px-0.5 rounded font-mono">0</kbd>
                </button>
              </div>
            </div>

            {/* ESP32 Dedicated MCU Control Card */}
            {singleComp?.type === 'esp32' && (
              <div className="bg-sky-950/20 border border-sky-500/30 rounded-xl p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <Cpu className="w-3.5 h-3.5 text-sky-600" />
                    <span className="text-[11px] font-bold text-slate-800">ESP32 Virtual MCU</span>
                  </div>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${
                      isResettingMCU
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    }`}
                  >
                    {isResettingMCU ? 'REBOOTING' : 'VIRTUAL (240MHz)'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                  <div className="bg-white p-1.5 rounded-lg border border-gray-200">
                    <span className="text-gray-400 block text-[9px]">VIRTUAL IP</span>
                    <span className="text-slate-800 font-bold">{mcuState.ipAddress}</span>
                  </div>
                  <div className="bg-white p-1.5 rounded-lg border border-gray-200">
                    <span className="text-gray-400 block text-[9px]">MODBUS TCP</span>
                    <span className="text-sky-600 font-bold">Port 502 [SIM]</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <button
                    onClick={rebootMCU}
                    disabled={isResettingMCU}
                    title="Simulate pressing the tactile EN button on the ESP32"
                    className="flex items-center justify-center space-x-1 px-2 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-[11px] font-bold transition shadow-xs"
                  >
                    <RotateCcw className={`w-3 h-3 ${isResettingMCU ? 'animate-spin' : ''}`} />
                    <span>Reset MCU (EN)</span>
                  </button>

                  <button
                    onClick={() => setSerialMonitorOpen(true)}
                    title="Open 115200 baud streaming serial console and C++ firmware IDE"
                    className="flex items-center justify-center space-x-1 px-2 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-[11px] font-bold transition shadow-xs"
                  >
                    <Terminal className="w-3 h-3" />
                    <span>Serial Monitor</span>
                  </button>
                </div>
              </div>
            )}

            {/* Component Circuit Netlist Connectivity Status */}
            {compStatus && (
              <div
                className={`p-2 rounded-xl border text-xs flex items-center justify-between ${
                  compStatus.connected
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}
              >
                <div className="flex items-center space-x-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      compStatus.connected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                    }`}
                  />
                  <span className="font-semibold text-[11px]">Electrical Circuit:</span>
                </div>
                <span className="font-bold text-[10px] uppercase tracking-wider">
                  {compStatus.label}
                </span>
              </div>
            )}

            {/* 3-Axis Rotation Controls Card */}
            <div className="bg-slate-50 p-2.5 rounded-xl border border-gray-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 flex items-center space-x-1">
                  <RotateCw className="w-3.5 h-3.5 text-sky-600" />
                  <span>3-Axis Rotation</span>
                </span>
                <button
                  onClick={() => resetRotation()}
                  className="text-[10px] text-gray-400 hover:text-sky-600 transition underline"
                  title="Reset rotation to [0, 0, 0]"
                >
                  Reset (0,0,0)
                </button>
              </div>

              {/* X-Axis: Pitch / Tilt Upright */}
              <div className="space-y-0.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-rose-600 font-bold flex items-center space-x-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                    <span>X-Axis (Pitch / Tilt)</span>
                  </span>
                  <span className="font-mono font-bold text-slate-800">{rotXDeg}°</span>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => rotateAxis('x', -Math.PI / 2)}
                    className="px-1.5 py-0.5 bg-white hover:bg-gray-100 border border-gray-200 rounded text-[10px] font-bold text-slate-700 transition"
                    title="Rotate -90° around X"
                  >
                    -90°
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    step="15"
                    value={rotXDeg}
                    onChange={(e) => setAxisAngle('x', (Number(e.target.value) * Math.PI) / 180)}
                    className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-rose-500"
                  />
                  <button
                    onClick={() => rotateAxis('x', Math.PI / 2)}
                    className="px-1.5 py-0.5 bg-white hover:bg-gray-100 border border-gray-200 rounded text-[10px] font-bold text-slate-700 transition"
                    title="Rotate +90° around X (Shortcut: X)"
                  >
                    +90°
                  </button>
                </div>
              </div>

              {/* Y-Axis: Yaw / Turn */}
              <div className="space-y-0.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-emerald-600 font-bold flex items-center space-x-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    <span>Y-Axis (Yaw / Turn)</span>
                  </span>
                  <span className="font-mono font-bold text-slate-800">{rotYDeg}°</span>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => rotateAxis('y', -Math.PI / 2)}
                    className="px-1.5 py-0.5 bg-white hover:bg-gray-100 border border-gray-200 rounded text-[10px] font-bold text-slate-700 transition"
                    title="Rotate -90° around Y"
                  >
                    -90°
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    step="15"
                    value={rotYDeg}
                    onChange={(e) => setAxisAngle('y', (Number(e.target.value) * Math.PI) / 180)}
                    className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <button
                    onClick={() => rotateAxis('y', Math.PI / 2)}
                    className="px-1.5 py-0.5 bg-white hover:bg-gray-100 border border-gray-200 rounded text-[10px] font-bold text-slate-700 transition"
                    title="Rotate +90° around Y (Shortcut: R)"
                  >
                    +90°
                  </button>
                </div>
              </div>

              {/* Z-Axis: Roll / Sideways Tilt */}
              <div className="space-y-0.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-sky-600 font-bold flex items-center space-x-1">
                    <span className="w-2 h-2 rounded-full bg-sky-500 inline-block" />
                    <span>Z-Axis (Roll / Bank)</span>
                  </span>
                  <span className="font-mono font-bold text-slate-800">{rotZDeg}°</span>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => rotateAxis('z', -Math.PI / 2)}
                    className="px-1.5 py-0.5 bg-white hover:bg-gray-100 border border-gray-200 rounded text-[10px] font-bold text-slate-700 transition"
                    title="Rotate -90° around Z"
                  >
                    -90°
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    step="15"
                    value={rotZDeg}
                    onChange={(e) => setAxisAngle('z', (Number(e.target.value) * Math.PI) / 180)}
                    className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-sky-500"
                  />
                  <button
                    onClick={() => rotateAxis('z', Math.PI / 2)}
                    className="px-1.5 py-0.5 bg-white hover:bg-gray-100 border border-gray-200 rounded text-[10px] font-bold text-slate-700 transition"
                    title="Rotate +90° around Z (Shortcut: Z)"
                  >
                    +90°
                  </button>
                </div>
              </div>

              {/* Quick Presets & 3D Gizmo Toggle */}
              <div className="pt-1 flex items-center space-x-1">
                <button
                  onClick={() => resetRotation()}
                  className="flex-1 py-1 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg text-[10px] font-semibold text-slate-600 transition"
                  title="Lay flat [0, 0, 0]"
                >
                  Flat (0°)
                </button>
                <button
                  onClick={() => setAxisAngle('x', Math.PI / 2)}
                  className="flex-1 py-1 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg text-[10px] font-semibold text-slate-600 transition"
                  title="Stand upright [90° X]"
                >
                  Upright
                </button>
                <button
                  onClick={() => setTransformMode(transformMode === 'rotate' ? 'translate' : 'rotate')}
                  className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition border flex items-center justify-center space-x-1 ${
                    transformMode === 'translate'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-sky-600 text-white border-sky-600 shadow-xs'
                  }`}
                  title="Toggle 3D interactive translation arrows (Move/Lift) vs rotation rings (Shortcut: T)"
                >
                  <span>{transformMode === 'translate' ? '↕️ 3D Arrows' : '🔄 3D Rings'}</span>
                  <kbd className="text-[8px] bg-black/20 text-white px-1 py-0.2 rounded font-mono">T</kbd>
                </button>
              </div>
            </div>
          </>
        )}

        <div className="flex items-center justify-between bg-amber-50/60 px-3 py-1.5 rounded-xl border border-amber-200">
          <span className="text-amber-800 font-medium flex items-center space-x-1.5">
            <Cable className="w-3.5 h-3.5 text-amber-600" />
            <span>Connected Wires</span>
          </span>
          <span className="font-mono font-bold text-amber-700">{connectedWires.length}</span>
        </div>
      </div>

      {/* Action Buttons: Rotate & Delete */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => rotateAxis('y', Math.PI / 2)}
          className="flex items-center justify-center space-x-1.5 px-3 py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-xl text-xs font-bold transition border border-sky-200 shadow-xs"
          title={isMulti ? 'Rotate all 90° (R)' : 'Rotate 90° around Y (Press R)'}
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>{isMulti ? 'Rotate All' : 'Rotate Y'}</span>
          <kbd className="text-[9px] bg-white px-1 py-0.2 rounded text-sky-600 font-mono border border-sky-200">R</kbd>
        </button>

        <button
          onClick={() => (isMulti ? removeSelectedComponents() : removeComponent(singleComp!.id))}
          className="flex items-center justify-center space-x-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition border border-rose-200 shadow-xs"
          title={isMulti ? 'Delete all selected (Del)' : 'Delete component (Press Del)'}
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>{isMulti ? 'Delete All' : 'Delete'}</span>
          <kbd className="text-[9px] bg-white px-1 py-0.2 rounded text-rose-500 font-mono border border-rose-200">Del</kbd>
        </button>
      </div>
    </div>
  );
};
