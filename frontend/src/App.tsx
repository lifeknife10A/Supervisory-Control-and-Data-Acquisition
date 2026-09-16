import { useState, useEffect } from 'react';
import { LabWorkbenchScene } from './components/3d/LabWorkbenchScene';
import { Toolbar } from './components/ui/Toolbar';
import { ComponentCatalog } from './components/ui/ComponentCatalog';
import { ComponentInspector } from './components/ui/ComponentInspector';
import { ViewCube } from './components/3d/ViewCube';
import { TelemetryPanel } from './components/ui/TelemetryPanel';
import { SerialMonitorModal } from './components/ui/SerialMonitorModal';
import { CircuitHealthModal } from './components/ui/CircuitHealthModal';
import { CircuitSchematicModal } from './components/ui/CircuitSchematicModal';
import { JsonMonitorModal } from './components/ui/JsonMonitorModal';
import { DestructiveConfirmModal } from './components/ui/DestructiveConfirmModal';
import { CircuitSimulationDashboard } from './components/ui/CircuitSimulationDashboard';
import { useWorkbenchStore } from './store/workbenchStore';
import { Layers, HelpCircle, Cable, RotateCw, Activity, ShieldCheck, Box, ArrowUp, ArrowDown } from 'lucide-react';

export function App() {
  const isSerialMonitorOpen = useWorkbenchStore((s) => s.isSerialMonitorOpen);
  const setSerialMonitorOpen = useWorkbenchStore((s) => s.setSerialMonitorOpen);
  const [showTelemetry, setShowTelemetry] = useState(false);
  const [showCircuitDashboard, setShowCircuitDashboard] = useState(false);

  const isSimulating = useWorkbenchStore((s) => s.isSimulating);
  const tickMCU = useWorkbenchStore((s) => s.tickMCU);

  // Autonomous Virtual MCU closed-loop simulation timer (300ms continuous streaming rate)
  useEffect(() => {
    if (!isSimulating) return;
    const interval = setInterval(() => {
      tickMCU();
    }, 300);
    return () => clearInterval(interval);
  }, [isSimulating, tickMCU]);

  const selectedIds = useWorkbenchStore((s) => s.selectedComponentIds);
  const components = useWorkbenchStore((s) => s.components);
  const wires = useWorkbenchStore((s) => s.wires);
  const setSelectedComponentIds = useWorkbenchStore((s) => s.setSelectedComponentIds);
  const rotateSelectedComponent = useWorkbenchStore((s) => s.rotateSelectedComponent);
  const removeSelectedComponents = useWorkbenchStore((s) => s.removeSelectedComponents);
  const cancelWireDraft = useWorkbenchStore((s) => s.cancelWireDraft);
  const setCameraView = useWorkbenchStore((s) => s.setCameraView);
  const isCatalogOpen = useWorkbenchStore((s) => s.isCatalogOpen);
  const toggleCatalog = useWorkbenchStore((s) => s.toggleCatalog);
  const circuitHealth = useWorkbenchStore((s) => s.circuitHealth);
  const setCircuitHealthModalOpen = useWorkbenchStore((s) => s.setCircuitHealthModalOpen);

  const isMulti = selectedIds.length > 1;
  const singleComp = selectedIds.length === 1 ? components.find((c) => c.id === selectedIds[0]) : null;

  const rotateAxis = useWorkbenchStore((s) => s.rotateSelectedComponentAxis);
  const elevateSelectedComponents = useWorkbenchStore((s) => s.elevateSelectedComponents);
  const setSelectedComponentElevation = useWorkbenchStore((s) => s.setSelectedComponentElevation);
  const transformMode = useWorkbenchStore((s) => s.transformMode);
  const setTransformMode = useWorkbenchStore((s) => s.setTransformMode);

  // Global Keyboard Shortcuts (Tinkercad-style)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keystrokes when typing into text inputs/textareas
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === 'r' || e.key === 'R' || e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        rotateAxis('y', e.shiftKey ? -Math.PI / 2 : Math.PI / 2);
      } else if (e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        rotateAxis('x', e.shiftKey ? -Math.PI / 2 : Math.PI / 2);
      } else if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        rotateAxis('z', e.shiftKey ? -Math.PI / 2 : Math.PI / 2);
      } else if (e.key === 'e' || e.key === 'E' || e.key === 'PageUp') {
        e.preventDefault();
        elevateSelectedComponents(0.02);
      } else if (e.key === 'q' || e.key === 'Q' || e.key === 'PageDown') {
        e.preventDefault();
        elevateSelectedComponents(-0.02);
      } else if (e.key === '0') {
        e.preventDefault();
        setSelectedComponentElevation(0.005);
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        setTransformMode(transformMode === 'rotate' ? 'translate' : 'rotate');
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) {
          e.preventDefault();
          removeSelectedComponents();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedComponentIds([]);
        cancelWireDraft();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedIds,
    rotateAxis,
    elevateSelectedComponents,
    setSelectedComponentElevation,
    transformMode,
    setTransformMode,
    removeSelectedComponents,
    cancelWireDraft,
    setSelectedComponentIds,
  ]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-white">
      {/* 1. Main 3D Three.js Lab Workbench Canvas */}
      <LabWorkbenchScene />

      {/* 2. Top Header & Toolbar */}
      <Toolbar
        onOpenExport={() => setSerialMonitorOpen(true)}
        onToggleTelemetry={() => setShowTelemetry(!showTelemetry)}
        showTelemetry={showTelemetry}
        onToggleCircuitDashboard={() => setShowCircuitDashboard(!showCircuitDashboard)}
        showCircuitDashboard={showCircuitDashboard}
      />

      {/* 3. Right Component Catalog (Collapsible Drawer with drag-and-drop) */}
      <ComponentCatalog />

      {/* 4. ViewCube (Isometric, Top Schematic, Front Views) */}
      <ViewCube onSetCamera={setCameraView} showTelemetry={showTelemetry} />

      {/* 5. Floating Component Inspector (Shows for selected component) */}
      <ComponentInspector showTelemetry={showTelemetry} />

      {/* 6. Floating Telemetry & Actuator Panel on Left */}
      {showTelemetry && <TelemetryPanel onClose={() => setShowTelemetry(false)} />}

      {/* 6b. Circuit Simulation Dashboard on Right */}
      {showCircuitDashboard && <CircuitSimulationDashboard onClose={() => setShowCircuitDashboard(false)} />}

      {/* 7. ESP32 Firmware & Serial Studio Modal */}
      <SerialMonitorModal
        isOpen={isSerialMonitorOpen}
        onClose={() => setSerialMonitorOpen(false)}
      />

      {/* 8. Circuit Diagnostics & Health Modal */}
      <CircuitHealthModal />

      {/* 8b. Reference Circuit Schematic & Netlist Modal */}
      <CircuitSchematicModal />

      {/* 8c. Live JSON Telemetry Stream & HTTP Bridge Monitor */}
      <JsonMonitorModal />

      {/* 9. Destructive Action Confirmation Modal */}
      <DestructiveConfirmModal />

      {/* 10. Desktop Bottom Navigation & Status Bar */}
      <footer className="hidden md:flex absolute bottom-3 left-4 right-4 z-20 flex-wrap items-center justify-between gap-3 pointer-events-none text-xs text-slate-600 select-none">
        {/* Left: Selected Component & Quick Controls */}
        <div className="flex items-center space-x-2 bg-white/95 backdrop-blur-md border border-gray-200 px-3.5 py-1.5 rounded-full shadow-md pointer-events-auto">
          <Layers className="w-4 h-4 text-sky-600" />
          {isMulti ? (
            <div className="flex items-center space-x-2.5">
              <span className="text-slate-800 font-bold">{selectedIds.length} Items Selected</span>
              <button
                onClick={() => elevateSelectedComponents(0.02)}
                className="flex items-center space-x-1 text-[11px] bg-sky-50 hover:bg-sky-100 text-sky-700 px-2 py-0.5 rounded-md border border-sky-200 transition font-semibold"
                title="Lift all selected up +2cm (Shortcut: E or PageUp)"
              >
                <ArrowUp className="w-3 h-3" />
                <span>Lift [E]</span>
              </button>
              <button
                onClick={() => elevateSelectedComponents(-0.02)}
                className="flex items-center space-x-1 text-[11px] bg-sky-50 hover:bg-sky-100 text-sky-700 px-2 py-0.5 rounded-md border border-sky-200 transition font-semibold"
                title="Lower all selected down -2cm (Shortcut: Q or PageDown)"
              >
                <ArrowDown className="w-3 h-3" />
                <span>Lower [Q]</span>
              </button>
              <button
                onClick={() => rotateSelectedComponent(Math.PI / 2)}
                className="flex items-center space-x-1 text-[11px] bg-sky-50 hover:bg-sky-100 text-sky-700 px-2 py-0.5 rounded-md border border-sky-200 transition font-semibold"
                title="Rotate all 90° (R)"
              >
                <RotateCw className="w-3 h-3" />
                <span>Rotate All [R]</span>
              </button>
              <button
                onClick={() => setSelectedComponentIds([])}
                className="text-[10px] text-gray-500 hover:text-slate-800 underline ml-1"
              >
                Deselect (Esc)
              </button>
            </div>
          ) : singleComp ? (
            <div className="flex items-center space-x-2.5">
              <span className="text-slate-800 font-bold">{singleComp.name}</span>
              <span className="text-[11px] font-mono text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.2 rounded font-semibold">
                Height: {(singleComp.position[1] * 100).toFixed(1)}cm
              </span>
              <button
                onClick={() => elevateSelectedComponents(0.02)}
                className="flex items-center space-x-1 text-[11px] bg-sky-50 hover:bg-sky-100 text-sky-700 px-2 py-0.5 rounded-md border border-sky-200 transition font-semibold"
                title="Lift up +2cm (Shortcut: E or PageUp)"
              >
                <ArrowUp className="w-3 h-3" />
                <span>Lift [E]</span>
              </button>
              <button
                onClick={() => elevateSelectedComponents(-0.02)}
                className="flex items-center space-x-1 text-[11px] bg-sky-50 hover:bg-sky-100 text-sky-700 px-2 py-0.5 rounded-md border border-sky-200 transition font-semibold"
                title="Lower down -2cm (Shortcut: Q or PageDown)"
              >
                <ArrowDown className="w-3 h-3" />
                <span>Lower [Q]</span>
              </button>
              <button
                onClick={() => rotateSelectedComponent(Math.PI / 2)}
                className="flex items-center space-x-1 text-[11px] bg-sky-50 hover:bg-sky-100 text-sky-700 px-2 py-0.5 rounded-md border border-sky-200 transition font-semibold"
                title="Rotate 90° (R)"
              >
                <RotateCw className="w-3 h-3" />
                <span>Rotate [R]</span>
              </button>
              <button
                onClick={() => setSelectedComponentIds([])}
                className="text-[10px] text-gray-500 hover:text-slate-800 underline ml-1"
              >
                Deselect (Esc)
              </button>
            </div>
          ) : (
            <span className="text-slate-500 font-medium">
              Drag on table to box-select • Hold <strong className="text-sky-600">Shift</strong> to rotate 3D view
            </span>
          )}
        </div>

        {/* Center: Live Wires Count Badge */}
        <div className="flex items-center space-x-2 bg-white/95 backdrop-blur-md border border-gray-200 px-3.5 py-1.5 rounded-full shadow-md pointer-events-auto">
          <Cable className="w-4 h-4 text-amber-500" />
          <span className="text-slate-700 font-semibold font-mono text-[11px]">
            {wires.length} Active Jumper Wires
          </span>
        </div>

        {/* Right: Camera Navigation Help */}
        <div className="flex items-center space-x-3 bg-white/95 backdrop-blur-md border border-gray-200 px-3.5 py-1.5 rounded-full shadow-md pointer-events-auto text-[11px] text-slate-600">
          <div className="flex items-center space-x-1">
            <HelpCircle className="w-3.5 h-3.5 text-sky-600" />
            <span>Orbit: <strong className="text-slate-800">Shift + Drag</strong></span>
          </div>
          <span className="text-gray-300">•</span>
          <span>Pan: <strong className="text-slate-800">Right Drag</strong></span>
          <span className="text-gray-300">•</span>
          <span>Zoom: <strong className="text-slate-800">Scroll</strong></span>
        </div>
      </footer>

      {/* 11. Mobile Bottom Navigation Dock (Visible on mobile < 768px) */}
      <nav
        aria-label="Mobile Viewport Dock"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-gray-200 px-3 py-2 flex items-center justify-around text-xs shadow-lg"
      >
        <button
          onClick={() => {
            setShowTelemetry(false);
            if (isCatalogOpen) toggleCatalog();
          }}
          className={`flex flex-col items-center space-y-0.5 ${
            !showTelemetry && !isCatalogOpen ? 'text-sky-600 font-bold' : 'text-slate-600 hover:text-sky-600'
          }`}
        >
          <Box className="w-4 h-4" />
          <span className="text-[10px] font-medium">3D View</span>
        </button>

        <button
          onClick={() => {
            if (!showTelemetry) {
              if (isCatalogOpen) toggleCatalog();
              setShowTelemetry(true);
            } else {
              setShowTelemetry(false);
            }
          }}
          className={`flex flex-col items-center space-y-0.5 ${
            showTelemetry ? 'text-sky-600 font-bold' : 'text-slate-600 hover:text-sky-600'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span className="text-[10px] font-medium">HMI Telemetry</span>
        </button>

        <button
          onClick={() => {
            if (!isCatalogOpen) {
              setShowTelemetry(false);
              toggleCatalog();
            } else {
              toggleCatalog();
            }
          }}
          className={`flex flex-col items-center space-y-0.5 ${
            isCatalogOpen ? 'text-sky-600 font-bold' : 'text-slate-600 hover:text-sky-600'
          }`}
        >
          <Cable className="w-4 h-4" />
          <span className="text-[10px] font-medium">Components</span>
        </button>

        <button
          onClick={() => setCircuitHealthModalOpen(true)}
          className={`flex flex-col items-center space-y-0.5 ${
            circuitHealth.isHealthy ? 'text-emerald-600' : 'text-amber-600 font-bold'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span className="text-[10px] font-medium">
            Circuit ({circuitHealth.validPathsCount}/{circuitHealth.totalRequiredPaths})
          </span>
        </button>

        <button
          onClick={() => {
            if (!showCircuitDashboard) {
              setShowTelemetry(false);
              if (isCatalogOpen) toggleCatalog();
              setShowCircuitDashboard(true);
            } else {
              setShowCircuitDashboard(false);
            }
          }}
          className={`flex flex-col items-center space-y-0.5 ${
            showCircuitDashboard ? 'text-amber-600 font-bold' : 'text-slate-600 hover:text-amber-600'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span className="text-[10px] font-medium">Simulation</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
