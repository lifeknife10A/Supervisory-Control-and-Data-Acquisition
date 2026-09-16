import React, { useState, useRef, useEffect } from 'react';
import {
  RotateCw,
  Trash2,
  Undo2,
  Redo2,
  Play,
  Square,
  Sliders,
  Sparkles,
  RotateCcw,
  ChevronDown,
  Layers,
  Check,
  Terminal,
  Cpu,
  Zap,
  Activity
} from 'lucide-react';
import { useWorkbenchStore } from '../../store/workbenchStore';

const TINKERCAD_WIRE_COLORS = [
  { label: 'Green', value: '#10b981' },
  { label: 'Black (GND)', value: '#1e293b' },
  { label: 'Red (VCC / 5V)', value: '#ef4444' },
  { label: 'Blue (Signal / SDA)', value: '#3b82f6' },
  { label: 'Yellow (SCL / Clock)', value: '#eab308' },
  { label: 'Orange (Actuator)', value: '#f97316' },
  { label: 'Purple (Gas / ADC)', value: '#a855f7' },
  { label: 'Brown', value: '#92400e' },
  { label: 'Grey', value: '#64748b' },
  { label: 'Cyan (Analog Out)', value: '#06b6d4' },
  { label: 'Pink', value: '#ec4899' },
  { label: 'White', value: '#f8fafc' },
];

interface ToolbarProps {
  onOpenExport: () => void;
  onToggleTelemetry: () => void;
  showTelemetry: boolean;
  onToggleCircuitDashboard?: () => void;
  showCircuitDashboard?: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  onOpenExport,
  onToggleTelemetry,
  showTelemetry,
  onToggleCircuitDashboard,
  showCircuitDashboard
}) => {
  const selectedComponentIds = useWorkbenchStore((s) => s.selectedComponentIds);
  const rotateSelectedComponent = useWorkbenchStore((s) => s.rotateSelectedComponent);
  const rotateAxis = useWorkbenchStore((s) => s.rotateSelectedComponentAxis);
  const resetRotation = useWorkbenchStore((s) => s.resetSelectedComponentRotation);
  const removeSelectedComponents = useWorkbenchStore((s) => s.removeSelectedComponents);
  const isCatalogOpen = useWorkbenchStore((s) => s.isCatalogOpen);
  const toggleCatalog = useWorkbenchStore((s) => s.toggleCatalog);
  const setCatalogOpen = useWorkbenchStore((s) => s.setCatalogOpen);
  const activeColor = useWorkbenchStore((s) => s.activeColor);
  const setActiveColor = useWorkbenchStore((s) => s.setActiveColor);
  const clearAllWires = useWorkbenchStore((s) => s.clearAllWires);
  const loadReferenceWiring = useWorkbenchStore((s) => s.loadReferenceWiring);
  const undo = useWorkbenchStore((s) => s.undo);
  const redo = useWorkbenchStore((s) => s.redo);
  const canUndo = useWorkbenchStore((s) => s.canUndo);
  const canRedo = useWorkbenchStore((s) => s.canRedo);
  const controlMode = useWorkbenchStore((s) => s.controlMode);
  const setControlMode = useWorkbenchStore((s) => s.setControlMode);
  const setDestructiveConfirmation = useWorkbenchStore((s) => s.setDestructiveConfirmation);
  const activeDraft = useWorkbenchStore((s) => s.activeDraft);
  const cancelWireDraft = useWorkbenchStore((s) => s.cancelWireDraft);
  const components = useWorkbenchStore((s) => s.components);
  const isSimulating = useWorkbenchStore((s) => s.isSimulating);
  const toggleSimulation = useWorkbenchStore((s) => s.toggleSimulation);
  const setSchematicModalOpen = useWorkbenchStore((s) => s.setSchematicModalOpen);
  const setJsonMonitorOpen = useWorkbenchStore((s) => s.setJsonMonitorOpen);

  const draftSourcePinInfo = React.useMemo(() => {
    if (!activeDraft) return null;
    const comp = components.find((c) => c.id === activeDraft.fromComponentId);
    const pin = comp?.pins.find((p) => p.id === activeDraft.fromPinId);
    return {
      compName: comp?.name || 'Component',
      pinName: pin?.name || 'Pin',
    };
  }, [activeDraft, components]);

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showRotateMenu, setShowRotateMenu] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const rotateMenuRef = useRef<HTMLDivElement>(null);

  const hasSelection = selectedComponentIds.length > 0;

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setShowColorPicker(false);
      }
      if (rotateMenuRef.current && !rotateMenuRef.current.contains(event.target as Node)) {
        setShowRotateMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="absolute top-0 left-0 right-0 z-30 flex flex-col bg-white border-b border-gray-200 shadow-xs select-none">
      {/* 1. Top Industrial SCADA Brand & View Row */}
      <div className="h-11 px-3 sm:px-4 flex items-center justify-between border-b border-gray-100">
        {/* Left: SCADA Brand & Title */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-sky-600 text-white shadow-xs" title="SCADA Industrial Process Control Lab">
            <Cpu className="w-4 h-4" />
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs sm:text-sm font-bold text-slate-800 tracking-tight truncate max-w-[150px] sm:max-w-none">
              SCADA Lab 3D
            </span>
            <span className="hidden sm:inline text-xs font-bold text-slate-400">
              – Industrial Simulator
            </span>
          </div>
        </div>

        {/* Right: Circuit Health & Camera View Switcher */}
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          {/* Mobile Quick Start/Stop Sim */}
          <button
            onClick={toggleSimulation}
            title={isSimulating ? 'Stop Simulation' : 'Start Simulation'}
            className={`md:hidden flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold transition shadow-xs ${
              isSimulating
                ? 'bg-rose-600 text-white'
                : 'bg-[#22c55e] text-white'
            }`}
          >
            {isSimulating ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
            <span>{isSimulating ? 'Stop' : 'Sim'}</span>
          </button>

          {/* Mobile Code / Serial */}
          <button
            onClick={onOpenExport}
            title="Open ESP32 Live Serial Monitor"
            className="md:hidden p-1.5 text-slate-700 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200"
          >
            <Terminal className="w-3.5 h-3.5 text-sky-600" />
          </button>
        </div>
      </div>

      {/* 2. Tinkercad Functional Action Sub-Toolbar (Desktop only) */}
      <div className="hidden md:flex h-11 px-4 items-center justify-between bg-white text-slate-700 text-xs">
        {/* Left Actions: Rotate, Delete, Undo/Redo, Wire Color Dropdown */}
        <div className="flex items-center space-x-1 sm:space-x-1.5">
          {/* Rotate Dropdown & Quick Actions */}
          <div className="relative flex items-center" ref={rotateMenuRef}>
            <button
              onClick={() => rotateSelectedComponent(Math.PI / 2)}
              disabled={!hasSelection}
              title={hasSelection ? 'Rotate 90° clockwise (Shortcut: R)' : 'Select a component to rotate'}
              className={`p-1.5 rounded-l-lg transition flex items-center space-x-1 border border-r-0 ${
                hasSelection
                  ? 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100 cursor-pointer shadow-xs'
                  : 'text-gray-300 border-gray-200 cursor-not-allowed'
              }`}
            >
              <RotateCw className="w-4 h-4" />
              <span className="hidden md:inline font-semibold">Rotate</span>
              <kbd className="text-[9px] bg-gray-100 text-gray-500 px-1 py-0.2 rounded font-mono">R</kbd>
            </button>
            <button
              onClick={() => setShowRotateMenu(!showRotateMenu)}
              disabled={!hasSelection}
              title="More rotation options (X, Y, Z axes)"
              className={`p-1.5 rounded-r-lg transition flex items-center border ${
                hasSelection
                  ? 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100 cursor-pointer shadow-xs'
                  : 'text-gray-300 border-gray-200 cursor-not-allowed'
              }`}
            >
              <ChevronDown className="w-3 h-3" />
            </button>

            {/* Rotation Axis Menu */}
            {showRotateMenu && hasSelection && (
              <div className="absolute top-full left-0 mt-1.5 w-48 bg-white border border-gray-200 rounded-xl shadow-xl p-1.5 z-50 animate-in fade-in-50">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 py-1">
                  Rotate Orientation
                </div>
                <button
                  onClick={() => {
                    rotateAxis('y', Math.PI / 2);
                    setShowRotateMenu(false);
                  }}
                  className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-sky-50 text-slate-700 hover:text-sky-700 rounded-lg text-xs font-medium transition"
                >
                  <span className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-sky-500" />
                    <span>Turn Y (+90°)</span>
                  </span>
                  <kbd className="text-[9px] bg-gray-100 px-1 py-0.5 rounded font-mono text-gray-500">R</kbd>
                </button>
                <button
                  onClick={() => {
                    rotateAxis('x', Math.PI / 2);
                    setShowRotateMenu(false);
                  }}
                  className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-rose-50 text-slate-700 hover:text-rose-700 rounded-lg text-xs font-medium transition"
                >
                  <span className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span>Tilt X (+90°)</span>
                  </span>
                  <kbd className="text-[9px] bg-gray-100 px-1 py-0.5 rounded font-mono text-gray-500">X</kbd>
                </button>
                <button
                  onClick={() => {
                    rotateAxis('z', Math.PI / 2);
                    setShowRotateMenu(false);
                  }}
                  className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-lg text-xs font-medium transition"
                >
                  <span className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Roll Z (+90°)</span>
                  </span>
                  <kbd className="text-[9px] bg-gray-100 px-1 py-0.5 rounded font-mono text-gray-500">Z</kbd>
                </button>
                <div className="h-px bg-gray-100 my-1" />
                <button
                  onClick={() => {
                    resetRotation();
                    setShowRotateMenu(false);
                  }}
                  className="w-full text-left px-2 py-1 text-[11px] text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-md transition"
                >
                  Reset to Flat (0°, 0°, 0°)
                </button>
              </div>
            )}
          </div>



          {/* Delete Button (Shortcut: Del) */}
          <button
            onClick={removeSelectedComponents}
            disabled={!hasSelection}
            title={hasSelection ? 'Delete selected component(s) (Shortcut: Del)' : 'Select a component to delete'}
            className={`p-1.5 rounded-lg transition flex items-center space-x-1 border ${
              hasSelection
                ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100 cursor-pointer shadow-xs'
                : 'text-gray-300 border-transparent cursor-not-allowed'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden md:inline font-semibold">Delete</span>
            <kbd className="text-[9px] bg-gray-100 text-gray-500 px-1 py-0.2 rounded font-mono">Del</kbd>
          </button>

          {/* Undo / Redo */}
          <button
            onClick={undo}
            disabled={!canUndo}
            title={canUndo ? 'Undo last wiring change (Ctrl+Z)' : 'Nothing to undo'}
            className={`p-1.5 rounded-lg transition ${
              canUndo
                ? 'text-slate-700 hover:bg-gray-100 cursor-pointer shadow-xs'
                : 'text-gray-300 cursor-not-allowed'
            }`}
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            title={canRedo ? 'Redo wiring change (Ctrl+Y)' : 'Nothing to redo'}
            className={`p-1.5 rounded-lg transition ${
              canRedo
                ? 'text-slate-700 hover:bg-gray-100 cursor-pointer shadow-xs'
                : 'text-gray-300 cursor-not-allowed'
            }`}
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <div className="h-5 w-px bg-gray-200 mx-1" />

          {/* Wire Color Picker Dropdown (Exact Tinkercad Swatch Pill) */}
          <div className="relative" ref={colorPickerRef}>
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              title="Change wire color"
              className="flex items-center space-x-1.5 px-2 py-1 rounded-lg border border-gray-200 hover:border-gray-300 bg-gray-50 hover:bg-white transition shadow-xs"
            >
              <div
                className="w-4 h-4 rounded-sm border border-gray-300 shadow-xs"
                style={{ backgroundColor: activeColor }}
              />
              <ChevronDown className="w-3 h-3 text-gray-500" />
            </button>

            {/* Dropdown Palette Popover */}
            {showColorPicker && (
              <div className="absolute left-0 mt-1.5 w-48 bg-white border border-gray-200 rounded-xl shadow-xl p-2 z-50 animate-in fade-in-50">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1.5 mb-1.5">
                  Wire Color
                </div>
                <div className="grid grid-cols-6 gap-1.5 p-1">
                  {TINKERCAD_WIRE_COLORS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => {
                        setActiveColor(c.value);
                        setShowColorPicker(false);
                      }}
                      title={c.label}
                      className={`w-6 h-6 rounded-md border flex items-center justify-center transition-transform ${
                        activeColor === c.value
                          ? 'scale-110 ring-2 ring-sky-500 border-white shadow-sm'
                          : 'border-gray-300 hover:scale-105'
                      }`}
                      style={{ backgroundColor: c.value }}
                    >
                      {activeColor === c.value && (
                        <Check className={`w-3 h-3 ${c.value === '#f8fafc' ? 'text-black' : 'text-white'}`} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>



          {/* Auto-Wire Reference Circuit */}
          <button
            onClick={loadReferenceWiring}
            title="Auto-route verified industrial SCADA jumper wires"
            className="flex items-center space-x-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg transition font-medium shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden xl:inline">Auto-Wire</span>
          </button>

          {/* Clear Wires with Confirmation */}
          <button
            onClick={() => {
              setDestructiveConfirmation({
                type: 'clearWires',
                title: 'Clear All Jumper Wires',
                message:
                  'Are you sure you want to remove all jumper wires? The virtual ESP32 controller and sensors will lose connectivity, generating open-circuit condition telemetry and triggering SCADA alarms.',
                confirmLabel: 'Clear All Wires',
                onConfirm: clearAllWires,
              });
            }}
            title="Clear all jumper wires"
            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center: Live Wire Drafting Status Banner */}
        {activeDraft && (
          <div className="bg-amber-500 text-white font-bold text-xs px-3.5 py-1.5 rounded-full shadow-lg flex items-center space-x-2 border border-amber-400 animate-in fade-in-50">
            <span className="w-2.5 h-2.5 rounded-full bg-white inline-block animate-ping" />
            <span>
              From <span className="underline decoration-white/60 font-black">{draftSourcePinInfo?.compName}: {draftSourcePinInfo?.pinName}</span> ➔ Click target pin to connect
            </span>
            <button
              onClick={cancelWireDraft}
              title="Cancel wire connection (Shortcut: Esc)"
              className="ml-2 bg-black/20 hover:bg-black/40 text-white px-2 py-0.5 rounded-md text-[10px] font-bold transition"
            >
              Cancel (Esc)
            </button>
          </div>
        )}

        {/* Right Actions: Control Mode, Code/API, Start Simulation, Telemetry, Components */}
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          {/* Control Mode Switcher */}
          <div className="hidden lg:flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-xs font-semibold">
            <button
              onClick={() => setControlMode('auto')}
              className={`px-2.5 py-1 rounded-md transition ${
                controlMode === 'auto'
                  ? 'bg-sky-600 text-white shadow-xs font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Autonomous closed-loop PLC logic (PID/pump thresholding)"
            >
              Auto Loop
            </button>
            <button
              onClick={() => setControlMode('manual')}
              className={`px-2.5 py-1 rounded-md transition ${
                controlMode === 'manual'
                  ? 'bg-amber-600 text-white shadow-xs font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Manual actuator override mode"
            >
              Manual Override
            </button>
          </div>

          {/* Circuit Schematic & Netlist Modal */}
          <button
            onClick={() => setSchematicModalOpen(true)}
            title="Open Complete SCADA Circuit Schematic & Pinout Netlist"
            className="flex items-center space-x-1.5 px-2.5 py-1 text-slate-700 hover:text-slate-900 bg-sky-50/70 hover:bg-sky-100/80 rounded-lg border border-sky-200 transition font-semibold shadow-xs"
          >
            <Cpu className="w-3.5 h-3.5 text-sky-600" />
            <span className="hidden sm:inline">Schematic</span>
          </button>

          {/* Live JSON Monitor & LabVIEW HTTP Bridge */}
          <button
            onClick={() => setJsonMonitorOpen(true)}
            title="Open Live JSON Telemetry Stream & LabVIEW HTTP Bridge"
            className="flex items-center space-x-1.5 px-2.5 py-1 text-slate-700 hover:text-slate-900 bg-emerald-50/70 hover:bg-emerald-100/80 rounded-lg border border-emerald-200 transition font-semibold shadow-xs"
          >
            <Activity className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">JSON Monitor</span>
          </button>

          {/* ESP32 C++ Code & Serial Studio */}
          <button
            onClick={onOpenExport}
            title="Open ESP32 Live Serial Monitor & C++ Firmware IDE"
            className="flex items-center space-x-1.5 px-2.5 py-1 text-slate-700 hover:text-slate-900 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition font-semibold shadow-xs"
          >
            <Terminal className="w-3.5 h-3.5 text-sky-600" />
            <span className="hidden sm:inline">Code / Serial</span>
          </button>

          {/* Tinkercad Green Start Simulation Button */}
          <button
            onClick={toggleSimulation}
            title={isSimulating ? 'Stop Simulation' : 'Start Simulation'}
            className={`flex items-center space-x-1.5 px-3.5 py-1 rounded-lg font-bold transition shadow-xs ${
              isSimulating
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200 animate-pulse'
                : 'bg-[#22c55e] hover:bg-[#16a34a] text-white shadow-emerald-200'
            }`}
          >
            {isSimulating ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{isSimulating ? 'Stop Simulation' : 'Start Simulation'}</span>
          </button>

          {/* Telemetry Panel Toggle */}
          <button
            onClick={() => {
              // Opening Telemetry should close the Components drawer and Circuit Dashboard
              if (!showTelemetry) {
                if (isCatalogOpen) setCatalogOpen(false);
                if (showCircuitDashboard && onToggleCircuitDashboard) onToggleCircuitDashboard();
              }
              onToggleTelemetry();
            }}
            title="Toggle Industrial SCADA Telemetry Controls"
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg border transition font-medium ${
              showTelemetry
                ? 'bg-sky-50 text-sky-700 border-sky-300 font-bold'
                : 'text-gray-600 hover:bg-gray-100 border-gray-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Telemetry</span>
          </button>

          {/* Circuit Simulation Dashboard Toggle */}
          {onToggleCircuitDashboard && (
            <button
              onClick={() => {
                // Opening Circuit Dashboard should close Telemetry and Components drawer
                if (!showCircuitDashboard) {
                  if (showTelemetry) onToggleTelemetry();
                  if (isCatalogOpen) setCatalogOpen(false);
                }
                onToggleCircuitDashboard();
              }}
              title="Toggle Circuit Simulation Dashboard"
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg border transition font-medium ${
                showCircuitDashboard
                  ? 'bg-amber-50 text-amber-700 border-amber-300 font-bold'
                  : 'text-gray-600 hover:bg-gray-100 border-gray-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Circuit</span>
            </button>
          )}

          {/* Toggle Component Catalog Drawer */}
          <button
            onClick={() => {
              // Opening the Components drawer should close Telemetry for the same reason.
              if (!isCatalogOpen && showTelemetry) onToggleTelemetry();
              toggleCatalog();
            }}
            title={isCatalogOpen ? 'Collapse Component Drawer' : 'Open Component Drawer'}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg border transition font-medium ${
              isCatalogOpen
                ? 'bg-slate-900 text-white border-slate-900 font-bold'
                : 'bg-white text-slate-700 hover:bg-gray-100 border-gray-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-sky-500" />
            <span className="hidden sm:inline">Components</span>
          </button>
        </div>
      </div>
    </header>
  );
};
