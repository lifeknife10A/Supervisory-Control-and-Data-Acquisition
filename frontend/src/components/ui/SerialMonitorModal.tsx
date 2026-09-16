import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Copy,
  Check,
  Terminal,
  RotateCcw,
  Trash2,
  Send,
  Code2,
  Database,
  Download,
  Cpu,
  Play,
  Square
} from 'lucide-react';
import { useWorkbenchStore } from '../../store/workbenchStore';
import { ESP32_FIRMWARE_SOURCE } from '../../store/mcuSimulationEngine';

interface SerialMonitorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SerialMonitorModal: React.FC<SerialMonitorModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'serial' | 'code' | 'api'>('serial');
  const [commandInput, setCommandInput] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const serialLogs = useWorkbenchStore((s) => s.serialLogs);
  const mcuState = useWorkbenchStore((s) => s.mcuState);
  const isResettingMCU = useWorkbenchStore((s) => s.isResettingMCU);
  const rebootMCU = useWorkbenchStore((s) => s.rebootMCU);
  const sendSerialCommand = useWorkbenchStore((s) => s.sendSerialCommand);
  const clearSerialLogs = useWorkbenchStore((s) => s.clearSerialLogs);
  const isSimulating = useWorkbenchStore((s) => s.isSimulating);
  const toggleSimulation = useWorkbenchStore((s) => s.toggleSimulation);
  const telemetry = useWorkbenchStore((s) => s.telemetry);
  const components = useWorkbenchStore((s) => s.components);
  const wires = useWorkbenchStore((s) => s.wires);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Auto-scroll terminal to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && activeTab === 'serial') {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [serialLogs, autoScroll, activeTab]);

  // Outbound JSON telemetry payload matching the SCADA backend contract
  const exportPayload = React.useMemo(() => ({
    timestamp: (mcuState.bootEpoch || 1700000000) + Math.floor(mcuState.uptimeSeconds),
    source: '3D_VIRTUAL_WORKBENCH_ESP32',
    mcu: {
      model: 'ESP32-D0WDQ6 DevKit V1',
      cpu_freq_mhz: mcuState.cpuFreqMHz,
      free_heap_bytes: mcuState.freeHeap,
      uptime_seconds: mcuState.uptimeSeconds,
      ip_address: mcuState.ipAddress,
    },
    telemetry: {
      tank_level: Number(telemetry.tank_level.toFixed(1)),
      temperature: Number(telemetry.temperature.toFixed(1)),
      gas_ppm: Number(telemetry.gas_ppm.toFixed(0)),
      current_draw: Number(telemetry.current_draw.toFixed(2)),
      pump_active: telemetry.pump_active,
      valve_open: telemetry.valve_open,
      fan_active: telemetry.fan_active,
      status_class: telemetry.status_class,
    },
    modbus: {
      server_port: 502,
      slave_id: 1,
      holding_registers: mcuState.modbusRegisters,
      coils: mcuState.modbusCoils,
    },
    circuit: {
      total_components: components.length,
      active_wires: wires.length,
    },
  }), [mcuState, telemetry, components.length, wires.length]);

  const jsonString = React.useMemo(() => JSON.stringify(exportPayload, null, 2), [exportPayload]);

  // Expose global window function for external script/adapter polling
  useEffect(() => {
    (window as any).getSCADATelemetry = () => exportPayload;
  }, [exportPayload]);

  if (!isOpen) return null;

  const handleSendCommand = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!commandInput.trim()) return;
    sendSerialCommand(commandInput);
    setCommandInput('');
    if (inputRef.current) inputRef.current.focus();
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(ESP32_FIRMWARE_SOURCE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(jsonString);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handleDownloadCode = () => {
    const blob = new Blob([ESP32_FIRMWARE_SOURCE], { type: 'text/x-c++src' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'main.cpp';
    a.click();
    URL.revokeObjectURL(url);
  };

  const getLevelBadgeClass = (level: string) => {
    switch (level) {
      case 'BOOT':
        return 'bg-purple-950/80 text-purple-300 border-purple-800/60';
      case 'INFO':
        return 'bg-sky-950/80 text-sky-300 border-sky-800/60';
      case 'WARN':
        return 'bg-amber-950/80 text-amber-300 border-amber-800/60';
      case 'ALARM':
        return 'bg-rose-950/80 text-rose-300 border-rose-800/60 animate-pulse';
      case 'MODBUS':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60';
      case 'GPIO':
        return 'bg-cyan-950/80 text-cyan-300 border-cyan-800/60';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="serial-modal-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in-50"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl h-[86vh] max-h-[780px] overflow-hidden shadow-2xl flex flex-col"
      >
        {/* 1. Modal Top Bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-950/50 select-none">
          {/* Left: Title & ESP32 Live Status */}
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-sky-500/10 text-sky-400 rounded-xl border border-sky-500/30">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 id="serial-modal-title" className="text-sm font-bold text-white tracking-tight">
                  ESP32 DevKit V1 – Virtual Firmware &amp; Serial Studio
                </h2>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    isResettingMCU
                      ? 'bg-amber-950 text-amber-300 border-amber-800 animate-pulse'
                      : isSimulating
                      ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {isResettingMCU ? 'REBOOTING (EN)' : isSimulating ? 'SIMULATED (240MHz)' : 'STANDBY'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                IP: <code className="text-sky-400">{mcuState.ipAddress} [VIRTUAL]</code> • Free Heap: <span className="text-slate-300 font-mono">{mcuState.freeHeap.toLocaleString()} bytes</span> • Uptime: <span className="text-slate-300 font-mono">{mcuState.uptimeSeconds}s</span>
              </p>
            </div>
          </div>

          {/* Right: Simulation Controls & Close */}
          <div className="flex items-center space-x-2">
            <button
              onClick={rebootMCU}
              disabled={isResettingMCU}
              title="Hardware Reset ESP32 (EN Button Trigger)"
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:border-amber-500/50 rounded-xl text-xs font-semibold transition"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isResettingMCU ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Reset MCU (EN)</span>
            </button>

            <button
              onClick={toggleSimulation}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs ${
                isSimulating
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {isSimulating ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span className="hidden sm:inline">{isSimulating ? 'Stop Sim' : 'Start Sim'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Navigation Tabs */}
        <div className="flex items-center justify-between px-5 bg-slate-900 border-b border-slate-800 select-none">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab('serial')}
              className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
                activeTab === 'serial'
                  ? 'border-sky-500 text-sky-400 bg-sky-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Terminal className="w-4 h-4" />
              <span>Live Serial Monitor (115200 baud)</span>
              <span className="bg-slate-800 text-[10px] text-slate-400 px-1.5 py-0.2 rounded-full font-mono">
                {serialLogs.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('code')}
              className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
                activeTab === 'code'
                  ? 'border-sky-500 text-sky-400 bg-sky-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 className="w-4 h-4" />
              <span>C++ Firmware Sketch (main.cpp)</span>
            </button>

            <button
              onClick={() => setActiveTab('api')}
              className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
                activeTab === 'api'
                  ? 'border-sky-500 text-sky-400 bg-sky-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>Outbound JSON & Modbus API</span>
            </button>
          </div>

          {/* Quick Sub-Actions for Active Tab */}
          {activeTab === 'serial' && (
            <div className="flex items-center space-x-3 text-xs text-slate-400">
              <label className="flex items-center space-x-1.5 cursor-pointer hover:text-slate-200">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0"
                />
                <span className="text-[11px]">Autoscroll</span>
              </label>

              <button
                onClick={clearSerialLogs}
                title="Clear console buffer"
                className="flex items-center space-x-1 text-[11px] text-slate-400 hover:text-rose-400 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </div>
          )}

          {activeTab === 'code' && (
            <div className="flex items-center space-x-2">
              <button
                onClick={handleCopyCode}
                className="flex items-center space-x-1 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg transition"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
              </button>
              <button
                onClick={handleDownloadCode}
                className="flex items-center space-x-1 px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white text-xs rounded-lg transition font-medium"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .cpp</span>
              </button>
            </div>
          )}

          {activeTab === 'api' && (
            <button
              onClick={handleCopyJson}
              className="flex items-center space-x-1 px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white text-xs rounded-lg transition font-medium"
            >
              {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedJson ? 'Copied JSON!' : 'Copy JSON'}</span>
            </button>
          )}
        </div>

        {/* 3. Tab Body */}
        <div className="flex-1 overflow-hidden flex flex-col bg-slate-950">
          {/* TAB 1: SERIAL MONITOR */}
          {activeTab === 'serial' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Terminal Log Output */}
              <div className="flex-1 p-4 overflow-y-auto font-mono text-xs text-slate-300 space-y-1 select-text">
                {serialLogs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-2">
                    <Terminal className="w-8 h-8 stroke-1" />
                    <p className="text-xs">Serial buffer is empty. Start simulation or click Reset MCU (EN).</p>
                  </div>
                ) : (
                  serialLogs.map((log) => (
                    <div key={log.id} className="flex items-start space-x-2 leading-relaxed hover:bg-slate-900/60 px-1 py-0.5 rounded">
                      <span className="text-slate-500 text-[11px] select-none shrink-0 font-mono">
                        [{log.timestamp}]
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded border select-none shrink-0 ${getLevelBadgeClass(
                          log.level
                        )}`}
                      >
                        {log.level}
                      </span>
                      <span className="text-slate-200 whitespace-pre-wrap break-words flex-1">
                        {log.message}
                      </span>
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>

              {/* Terminal Quick Command Chips */}
              <div className="px-4 py-1.5 bg-slate-900/80 border-t border-slate-800/80 flex items-center space-x-1.5 overflow-x-auto text-[11px] text-slate-400 select-none">
                <span className="text-slate-500 font-semibold mr-1 shrink-0">Quick Commands:</span>
                {['status', 'modbus', 'gpio', 'set pump 1', 'set pump 0', 'set valve 1', 'set fan 1', 'reboot', 'help'].map(
                  (cmd) => (
                    <button
                      key={cmd}
                      onClick={() => {
                        sendSerialCommand(cmd);
                      }}
                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 hover:text-white rounded border border-slate-700 transition font-mono shrink-0"
                    >
                      {cmd}
                    </button>
                  )
                )}
              </div>

              {/* Terminal CLI Command Input Bar */}
              <form
                onSubmit={handleSendCommand}
                className="p-3 bg-slate-900 border-t border-slate-800 flex items-center space-x-2"
              >
                <div className="flex items-center text-sky-400 pl-2 font-mono font-bold text-sm">
                  &gt;
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  value={commandInput}
                  onChange={(e) => setCommandInput(e.target.value)}
                  placeholder="Send command to ESP32 serial interface (e.g. 'status', 'modbus', 'set pump 1')..."
                  className="flex-1 bg-slate-950 text-slate-100 placeholder-slate-500 text-xs font-mono px-3 py-2 rounded-xl border border-slate-700/80 focus:outline-none focus:border-sky-500 transition"
                />
                <button
                  type="submit"
                  disabled={!commandInput.trim()}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition ${
                    commandInput.trim()
                      ? 'bg-sky-600 hover:bg-sky-500 text-white shadow'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <span>Send</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: ARDUINO C++ FIRMWARE CODE IDE */}
          {activeTab === 'code' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-5 py-2.5 bg-slate-900/60 border-b border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>
                    Production ESP-IDF / Arduino Core Sketch • <strong className="text-white">ESP32 DevKit V1</strong>
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                  Target: ESP32-WROOM-32 | Flash: 4MB | Modbus TCP Port 502
                </span>
              </div>
              <div className="flex-1 p-4 overflow-y-auto bg-[#0a0e17] font-mono text-xs text-slate-200 select-text leading-relaxed">
                <pre className="overflow-x-auto text-sky-300/90 font-mono">
                  {ESP32_FIRMWARE_SOURCE}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 3: OUTBOUND JSON & MODBUS API */}
          {activeTab === 'api' && (
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              {/* Left: JSON Telemetry Contract */}
              <div className="flex-1 flex flex-col border-r border-slate-800 overflow-hidden">
                <div className="px-4 py-2 bg-slate-900/60 border-b border-slate-800 text-xs font-semibold text-slate-300">
                  Live JSON Telemetry Stream
                </div>
                <div className="flex-1 p-4 overflow-y-auto bg-slate-950 font-mono text-xs text-cyan-300">
                  <pre className="leading-relaxed select-text">{jsonString}</pre>
                </div>
              </div>

              {/* Right: Modbus Register Mapping Table */}
              <div className="w-full md:w-80 flex flex-col bg-slate-900/40 overflow-y-auto p-4 space-y-4 text-xs text-slate-300">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Modbus TCP Map (Port 502)
                    </h4>
                    <span className="text-[10px] bg-sky-950 text-sky-400 px-1.5 py-0.5 rounded border border-sky-800 font-mono">
                      IN-BROWSER SIM
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                    Synchronized in-memory register table reflecting virtual MCU state and circuit health.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                    <span>Holding Registers (4xxxx)</span>
                    <span className="font-mono text-[10px] text-slate-500">FC 03 / 06</span>
                  </div>
                  <div className="bg-slate-950 rounded-xl p-2.5 border border-slate-800 space-y-2 font-mono text-[11px]">
                    <div className="flex justify-between items-center border-b border-slate-900 pb-1">
                      <div>
                        <span className="text-sky-400 font-bold block">40001 (Offset 0x0000)</span>
                        <span className="text-[10px] text-slate-400">Tank Level (x10 %)</span>
                      </div>
                      <span className="text-white font-bold">{mcuState.modbusRegisters[40001]}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-900 pb-1">
                      <div>
                        <span className="text-sky-400 font-bold block">40002 (Offset 0x0001)</span>
                        <span className="text-[10px] text-slate-400">Temperature (x10 °C)</span>
                      </div>
                      <span className="text-white font-bold">{mcuState.modbusRegisters[40002]}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-900 pb-1">
                      <div>
                        <span className="text-sky-400 font-bold block">40003 (Offset 0x0002)</span>
                        <span className="text-[10px] text-slate-400">Hazardous Gas (PPM)</span>
                      </div>
                      <span className="text-white font-bold">{mcuState.modbusRegisters[40003]}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-sky-400 font-bold block">40004 (Offset 0x0003)</span>
                        <span className="text-[10px] text-slate-400">Motor Current (x100 A)</span>
                      </div>
                      <span className="text-white font-bold">{mcuState.modbusRegisters[40004]}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                    <span>Discrete Coils (0xxxx)</span>
                    <span className="font-mono text-[10px] text-slate-500">FC 01 / 05</span>
                  </div>
                  <div className="bg-slate-950 rounded-xl p-2.5 border border-slate-800 space-y-2 font-mono text-[11px]">
                    <div className="flex justify-between items-center border-b border-slate-900 pb-1">
                      <div>
                        <span className="text-amber-400 font-bold block">00001 (Offset 0x0000)</span>
                        <span className="text-[10px] text-slate-400">Feed Pump (GPIO 26)</span>
                      </div>
                      <span className={mcuState.modbusCoils[1] ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                        {mcuState.modbusCoils[1] ? '1 (ENERGIZED)' : '0 (OFF)'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-900 pb-1">
                      <div>
                        <span className="text-amber-400 font-bold block">00002 (Offset 0x0001)</span>
                        <span className="text-[10px] text-slate-400">Safety Valve (GPIO 27)</span>
                      </div>
                      <span className={mcuState.modbusCoils[2] ? 'text-rose-400 font-bold' : 'text-slate-500'}>
                        {mcuState.modbusCoils[2] ? '1 (OPEN)' : '0 (CLOSED)'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-amber-400 font-bold block">00003 (Offset 0x0002)</span>
                        <span className="text-[10px] text-slate-400">Exhaust Fan (GPIO 14)</span>
                      </div>
                      <span className={mcuState.modbusCoils[3] ? 'text-cyan-400 font-bold' : 'text-slate-500'}>
                        {mcuState.modbusCoils[3] ? '1 (RUNNING)' : '0 (STANDBY)'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 space-y-1.5">
                  <div className="text-[10px] text-slate-500 leading-normal">
                    Protocol note: Over-the-wire PDU addressing transmits zero-based offsets (0 to 3), which standard PLC HMIs map to 40001-40004 and 00001-00003.
                  </div>
                  <div>Polling API: <code className="text-cyan-300">window.getSCADATelemetry()</code></div>
                  <div>Transport: In-Browser Virtual Simulation • Modbus TCP Engine</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
