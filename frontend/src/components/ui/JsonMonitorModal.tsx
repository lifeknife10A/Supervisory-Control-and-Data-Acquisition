import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Activity,
  FileCode,
  Download,
  Copy,
  Check,
  Play,
  Pause,
  Square,
  Upload,
  Radio,
  Sliders,
  Wifi,
  Database,
  Clock,
  Zap,
} from 'lucide-react';
import { useWorkbenchStore } from '../../store/workbenchStore';

export const JsonMonitorModal: React.FC = () => {
  const isOpen = useWorkbenchStore((s) => s.isJsonMonitorOpen);
  const setIsOpen = useWorkbenchStore((s) => s.setJsonMonitorOpen);
  const telemetry = useWorkbenchStore((s) => s.telemetry);
  const setTelemetry = useWorkbenchStore((s) => s.setTelemetry);
  const tickMCU = useWorkbenchStore((s) => s.tickMCU);
  const isSimulating = useWorkbenchStore((s) => s.isSimulating);

  const [activeTab, setActiveTab] = useState<'live' | 'poll' | 'file' | 'inject'>('live');
  const [copied, setCopied] = useState(false);

  // Continuous Stream Engine State
  const [streamRateMs, setStreamRateMs] = useState(250);
  const [isStreamPaused, setIsStreamPaused] = useState(false);
  const [packetCount, setPacketCount] = useState(0);
  const [liveTimestamp, setLiveTimestamp] = useState(new Date().toISOString());
  const [autoScrollLog, setAutoScrollLog] = useState(true);

  // HTTP Polling Bridge State
  const [httpEndpoint, setHttpEndpoint] = useState('http://localhost:8000/api/telemetry');
  const [isHttpPolling, setIsHttpPolling] = useState(false);
  const [pollIntervalMs, setPollIntervalMs] = useState(500);
  const [pollStatus, setPollStatus] = useState<'idle' | 'connected' | 'error'>('idle');
  const [pollErrorMsg, setPollErrorMsg] = useState('');
  const [lastLatencyMs, setLastLatencyMs] = useState(14);

  // Packet Stream Logs
  const [packetLogs, setPacketLogs] = useState<
    Array<{
      id: string;
      seq: number;
      timestamp: string;
      source: string;
      size: number;
      status: string;
      data: any;
    }>
  >([]);

  // File Upload State
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);
  const [fileJsonPreview, setFileJsonPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Current SCADA Telemetry payload object
  const currentPayload = {
    tank_level: parseFloat(telemetry.tank_level.toFixed(2)),
    temperature: parseFloat(telemetry.temperature.toFixed(2)),
    gas_ppm: parseFloat(telemetry.gas_ppm.toFixed(1)),
    current_draw: parseFloat(telemetry.current_draw.toFixed(2)),
    pump_active: telemetry.pump_active,
    valve_open: telemetry.valve_open,
    fan_active: telemetry.fan_active,
    status_class: telemetry.status_class,
    health_label:
      telemetry.status_class === 2
        ? 'CRITICAL_FAULT'
        : telemetry.status_class === 1
        ? 'MAINTENANCE_WARNING'
        : 'HEALTHY',
    timestamp: liveTimestamp,
  };

  // Continuous Stream Timer Loop (Guaranteed continuous ticks when modal is open)
  useEffect(() => {
    if (!isOpen || isStreamPaused) return;

    const timer = setInterval(() => {
      const now = new Date();
      const isoTime = now.toISOString();
      setLiveTimestamp(isoTime);

      // If in virtual simulation mode, advance physics step to produce continuous live fluctuation
      if (!isHttpPolling && isSimulating) {
        tickMCU();
      }

      const timeStr =
        now.toTimeString().split(' ')[0] +
        '.' +
        String(now.getMilliseconds()).padStart(3, '0');
      const payloadStr = JSON.stringify(currentPayload);

      setPacketCount((c) => {
        const nextSeq = c + 1;
        setPacketLogs((prev) => [
          {
            id: Math.random().toString(36).substring(2, 9),
            seq: nextSeq,
            timestamp: timeStr,
            source: isHttpPolling ? 'HTTP Poller (LabVIEW)' : 'Virtual MCU Closed-Loop',
            size: payloadStr.length,
            status:
              telemetry.status_class === 2
                ? 'FAULT (Class 2)'
                : telemetry.status_class === 1
                ? 'WARN (Class 1)'
                : 'OK (Class 0)',
            data: { ...currentPayload, timestamp: isoTime },
          },
          ...prev.slice(0, 49),
        ]);
        return nextSeq;
      });
    }, streamRateMs);

    return () => clearInterval(timer);
  }, [isOpen, isStreamPaused, streamRateMs, isHttpPolling, isSimulating, telemetry]);

  // Auto-scroll log container to top on new packet
  useEffect(() => {
    if (autoScrollLog && logContainerRef.current) {
      logContainerRef.current.scrollTop = 0;
    }
  }, [packetLogs, autoScrollLog]);

  // HTTP Poller Loop (LabVIEW / Python FastAPI Bridge)
  useEffect(() => {
    if (!isHttpPolling) return;
    let timer: any;

    const poll = async () => {
      const startTime = performance.now();
      try {
        const res = await fetch(httpEndpoint, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
        const elapsed = Math.round(performance.now() - startTime);
        setLastLatencyMs(elapsed);

        if (res.ok) {
          const data = await res.json();
          setPollStatus('connected');
          setPollErrorMsg('');
          setTelemetry(data);
        } else {
          setPollStatus('error');
          setPollErrorMsg(`HTTP Error ${res.status}: ${res.statusText}`);
        }
      } catch (err: any) {
        setPollStatus('error');
        setPollErrorMsg(
          err.message || 'Connection refused (Check if Python/LabVIEW backend is running)'
        );
      }
    };

    poll();
    timer = setInterval(poll, pollIntervalMs);
    return () => clearInterval(timer);
  }, [isHttpPolling, httpEndpoint, pollIntervalMs, setTelemetry]);

  if (!isOpen) return null;

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(currentPayload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(currentPayload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scada_telemetry_snapshot_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadNdjsonLog = () => {
    const ndjsonContent = packetLogs.map((p) => JSON.stringify(p.data)).join('\n');
    const blob = new Blob([ndjsonContent], { type: 'application/x-ndjson' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scada_stream_log_${Date.now()}.ndjson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        setFileJsonPreview(JSON.stringify(parsed, null, 2));
        if (
          typeof parsed.tank_level === 'number' ||
          typeof parsed.temperature === 'number' ||
          typeof parsed.gas_ppm === 'number'
        ) {
          setTelemetry(parsed);
        }
      } catch (err) {
        alert('Invalid JSON file format.');
      }
    };
    reader.readAsText(file);
  };

  const streamHz = (1000 / streamRateMs).toFixed(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 md:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white tracking-wide">
                  Live JSON Telemetry Monitor & Bridge
                </h2>
                <span className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-xs">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isStreamPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'
                    }`}
                  />
                  <span>
                    {isStreamPaused
                      ? 'STREAM PAUSED'
                      : isHttpPolling
                      ? `HTTP POLLER LIVE (${pollIntervalMs}ms)`
                      : `CONTINUOUS STREAM LIVE (${streamRateMs}ms / ${streamHz}Hz)`}
                  </span>
                </span>
              </div>
              <p className="text-xs text-slate-400">
                High-precision SCADA JSON streaming observer, LabVIEW HTTP bridge, and packet sequencer
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsOpen(false)}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab & Mode Selector */}
        <div className="flex items-center justify-between px-6 bg-slate-900/90 border-b border-slate-800">
          <div className="flex space-x-1">
            {[
              { id: 'live', label: 'Live JSON Stream', icon: FileCode },
              { id: 'poll', label: 'LabVIEW / Python HTTP Bridge', icon: Wifi },
              { id: 'file', label: 'JSON File Watcher', icon: Database },
              { id: 'inject', label: 'Telemetry Testbench Injector', icon: Sliders },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center space-x-2 px-4 py-3 text-xs font-semibold border-b-2 transition ${
                    isActive
                      ? 'border-emerald-400 text-emerald-300 bg-emerald-500/5'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopyJson}
              className="flex items-center space-x-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition border border-slate-700"
              title="Copy current JSON payload to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy JSON'}</span>
            </button>
            <button
              onClick={handleDownloadJson}
              className="flex items-center space-x-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition shadow"
              title="Download current snapshot as .json"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Snapshot JSON</span>
            </button>
            <button
              onClick={handleDownloadNdjsonLog}
              className="flex items-center space-x-1 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition shadow"
              title="Export all streamed packets as .ndjson (Newline Delimited JSON)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Stream Log</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950/40">
          {/* TAB 1: Live JSON Stream & Packet Log */}
          {activeTab === 'live' && (
            <div className="flex flex-col space-y-4 h-full">
              {/* Continuous Stream Control Ribbon */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900/90 border border-slate-800 rounded-xl text-xs">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setIsStreamPaused(!isStreamPaused)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-bold transition shadow-xs cursor-pointer ${
                      isStreamPaused
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-amber-600 hover:bg-amber-500 text-white'
                    }`}
                  >
                    {isStreamPaused ? (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Resume Stream</span>
                      </>
                    ) : (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        <span>Pause Stream</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center space-x-2">
                    <span className="text-slate-400 font-medium">Stream Rate:</span>
                    <select
                      value={streamRateMs}
                      onChange={(e) => setStreamRateMs(Number(e.target.value))}
                      className="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-700 text-xs font-mono text-emerald-400 focus:outline-none cursor-pointer"
                    >
                      <option value={100}>100ms (10 Hz High-Speed)</option>
                      <option value={250}>250ms (4 Hz Standard)</option>
                      <option value={500}>500ms (2 Hz Steady)</option>
                      <option value={1000}>1000ms (1 Hz Tick)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center space-x-4 text-[11px] font-mono text-slate-400">
                  <div className="flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5 text-purple-400" />
                    <span>UTC: <strong className="text-purple-300">{liveTimestamp}</strong></span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Packets: <strong className="text-amber-300">#{packetCount}</strong></span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <label className="flex items-center space-x-1 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={autoScrollLog}
                        onChange={(e) => setAutoScrollLog(e.target.checked)}
                        className="rounded border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
                      />
                      <span>Auto-Scroll Log</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Two-Column Stream Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-[380px]">
                {/* Left Column: Formatted JSON Tree */}
                <div className="lg:col-span-7 flex flex-col space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <span className="flex items-center space-x-1.5">
                      <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                      <span>Live SCADA Telemetry Object (Continuous Updating)</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {JSON.stringify(currentPayload).length} bytes • JSON Spec v2
                    </span>
                  </div>

                  <div className="flex-1 bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs overflow-auto shadow-inner">
                    <div className="space-y-0.5 text-slate-300 leading-relaxed select-text">
                      <div><span className="text-slate-600">{'{'}</span></div>
                      <div className="pl-4">
                        <span className="text-sky-400">"tank_level"</span>: <span className="text-amber-400 font-bold">{currentPayload.tank_level.toFixed(2)}</span>,
                      </div>
                      <div className="pl-4">
                        <span className="text-sky-400">"temperature"</span>: <span className="text-amber-400 font-bold">{currentPayload.temperature.toFixed(2)}</span>,
                      </div>
                      <div className="pl-4">
                        <span className="text-sky-400">"gas_ppm"</span>: <span className="text-amber-400 font-bold">{currentPayload.gas_ppm.toFixed(1)}</span>,
                      </div>
                      <div className="pl-4">
                        <span className="text-sky-400">"current_draw"</span>: <span className="text-amber-400 font-bold">{currentPayload.current_draw.toFixed(2)}</span>,
                      </div>
                      <div className="pl-4">
                        <span className="text-sky-400">"pump_active"</span>: <span className={currentPayload.pump_active ? 'text-emerald-400 font-bold' : 'text-slate-500'}>{String(currentPayload.pump_active)}</span>,
                      </div>
                      <div className="pl-4">
                        <span className="text-sky-400">"valve_open"</span>: <span className={currentPayload.valve_open ? 'text-purple-400 font-bold' : 'text-slate-500'}>{String(currentPayload.valve_open)}</span>,
                      </div>
                      <div className="pl-4">
                        <span className="text-sky-400">"fan_active"</span>: <span className={currentPayload.fan_active ? 'text-amber-400 font-bold' : 'text-slate-500'}>{String(currentPayload.fan_active)}</span>,
                      </div>
                      <div className="pl-4">
                        <span className="text-sky-400">"status_class"</span>: <span className="text-cyan-400 font-bold">{currentPayload.status_class}</span>,
                      </div>
                      <div className="pl-4">
                        <span className="text-sky-400">"health_label"</span>: <span className="text-emerald-300">"{currentPayload.health_label}"</span>,
                      </div>
                      <div className="pl-4">
                        <span className="text-sky-400">"timestamp"</span>: <span className="text-purple-400 font-medium">"{currentPayload.timestamp}"</span>
                      </div>
                      <div><span className="text-slate-600">{'}'}</span></div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Live Packet Stream Log */}
                <div className="lg:col-span-5 flex flex-col space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <span className="flex items-center space-x-1.5">
                      <Clock className="w-3.5 h-3.5 text-sky-400" />
                      <span>Packet Log Stream (Last 50 Packets)</span>
                    </span>
                    <button
                      onClick={() => setPacketLogs([])}
                      className="text-[10px] text-slate-500 hover:text-slate-300 underline cursor-pointer"
                    >
                      Clear Log
                    </button>
                  </div>

                  <div
                    ref={logContainerRef}
                    className="flex-1 bg-slate-900/80 p-3 rounded-xl border border-slate-800 overflow-y-auto space-y-2 max-h-[420px] font-mono text-[11px]"
                  >
                    {packetLogs.length === 0 ? (
                      <div className="text-center py-12 text-slate-600">
                        Waiting for next telemetry packet...
                      </div>
                    ) : (
                      packetLogs.map((log) => (
                        <div
                          key={log.id}
                          className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition space-y-1"
                        >
                          <div className="flex items-center justify-between text-[10px]">
                            <div className="flex items-center space-x-1.5">
                              <span className="text-amber-400 font-bold">#{log.seq}</span>
                              <span className="text-slate-400">{log.timestamp}</span>
                            </div>
                            <span
                              className={`px-1.5 py-0.2 rounded font-bold text-[9px] ${
                                log.status.includes('FAULT')
                                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                  : log.status.includes('WARN')
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              }`}
                            >
                              {log.status}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-slate-300 text-[10.5px]">
                            <span>
                              L:{log.data.tank_level.toFixed(1)}% | T:{log.data.temperature.toFixed(1)}°C | G:{log.data.gas_ppm.toFixed(0)}PPM
                            </span>
                            <span className="text-[10px] text-slate-500">{log.size}B</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LabVIEW / Python HTTP Bridge */}
          {activeTab === 'poll' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center space-x-2 text-sky-400 font-bold text-sm">
                  <Wifi className="w-5 h-5" />
                  <span>LabVIEW / Python FastAPI Continuous Telemetry Poller</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Connect directly to your local LabVIEW HTTP bridge or Python ML server (
                  <code>http://localhost:8000/api/telemetry</code>). When enabled, the frontend polls
                  the endpoint continuously at the configured rate and streams live sensor and actuator
                  states into the 3D workbench.
                </p>

                <div className="space-y-3 pt-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Target HTTP REST / Telemetry Endpoint URL:
                    </label>
                    <input
                      type="text"
                      value={httpEndpoint}
                      onChange={(e) => setHttpEndpoint(e.target.value)}
                      placeholder="http://localhost:8000/api/telemetry"
                      className="w-full bg-slate-950 px-3.5 py-2 rounded-lg border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        Polling Interval:
                      </label>
                      <select
                        value={pollIntervalMs}
                        onChange={(e) => setPollIntervalMs(Number(e.target.value))}
                        className="w-full bg-slate-950 px-3 py-2 rounded-lg border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-sky-500 cursor-pointer"
                      >
                        <option value={100}>100ms (10 Hz Ultra-Fast)</option>
                        <option value={200}>200ms (High-Speed SCADA)</option>
                        <option value={500}>500ms (Standard Polling)</option>
                        <option value={1000}>1000ms (1.0 Second)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        Poller State:
                      </label>
                      <button
                        onClick={() => setIsHttpPolling(!isHttpPolling)}
                        className={`w-full py-2 px-4 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-2 cursor-pointer ${
                          isHttpPolling
                            ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/30'
                            : 'bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-900/30'
                        }`}
                      >
                        {isHttpPolling ? (
                          <>
                            <Square className="w-3.5 h-3.5 fill-current" />
                            <span>Stop HTTP Poller</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Start Continuous Poller</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Poller Status Indicator */}
                  {isHttpPolling && (
                    <div className="mt-4 p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5 text-xs font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Connection Status:</span>
                        <span
                          className={`font-bold ${
                            pollStatus === 'connected'
                              ? 'text-emerald-400'
                              : pollStatus === 'error'
                              ? 'text-rose-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {pollStatus === 'connected'
                            ? '● CONNECTED (200 OK)'
                            : pollStatus === 'error'
                            ? '▲ CONNECTION FAILED'
                            : 'CONNECTING...'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Measured Latency:</span>
                        <span className="text-sky-300">{lastLatencyMs} ms</span>
                      </div>
                      {pollErrorMsg && (
                        <div className="text-rose-400 text-[11px] pt-1 border-t border-slate-800">
                          {pollErrorMsg}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: JSON File Watcher / Upload */}
          {activeTab === 'file' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm">
                  <Database className="w-5 h-5" />
                  <span>JSON File Telemetry Injector & Inspector</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Select or drop any recorded telemetry JSON dataset, LabVIEW flattened JSON log, or
                  Wokwi configuration file to load directly into the simulator.
                </p>

                {/* Upload Box */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-amber-400/60 rounded-xl p-8 text-center cursor-pointer transition bg-slate-950/50 hover:bg-slate-950/80"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".json"
                    className="hidden"
                  />
                  <Upload className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                  <span className="text-xs font-bold text-slate-200 block">
                    {loadedFileName ? `Loaded: ${loadedFileName}` : 'Click to Browse or Drag & Drop .JSON File'}
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-1">
                    Accepts SCADA Telemetry JSON, Modbus Dumps, and Wokwi Diagrams
                  </span>
                </div>

                {/* Preview */}
                {fileJsonPreview && (
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-300 block">Parsed File Contents:</span>
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-amber-300 max-h-[250px] overflow-auto">
                      <pre>{fileJsonPreview}</pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: Telemetry Testbench Injector */}
          {activeTab === 'inject' && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center space-x-2 text-purple-400 font-bold text-sm">
                  <Sliders className="w-5 h-5" />
                  <span>Manual Telemetry Mutation & Fault Injection Testbench</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Directly adjust JSON parameters below to simulate physical disturbances, pump cavitation,
                  overheating, and gas leaks. Observe how the 3D scene, LCD display, and status indicators
                  immediately react.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {/* Tank Level Slider */}
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-sky-400">Tank Level:</span>
                      <span className="font-mono text-white">{telemetry.tank_level.toFixed(1)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.5"
                      value={telemetry.tank_level}
                      onChange={(e) => setTelemetry({ tank_level: parseFloat(e.target.value) })}
                      className="w-full accent-sky-500 cursor-pointer"
                    />
                  </div>

                  {/* Temperature Slider */}
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-amber-400">Temperature:</span>
                      <span className="font-mono text-white">{telemetry.temperature.toFixed(1)}°C</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.5"
                      value={telemetry.temperature}
                      onChange={(e) => setTelemetry({ temperature: parseFloat(e.target.value) })}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </div>

                  {/* Gas PPM Slider */}
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-purple-400">Gas Concentration:</span>
                      <span className="font-mono text-white">{telemetry.gas_ppm.toFixed(0)} PPM</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1000"
                      step="10"
                      value={telemetry.gas_ppm}
                      onChange={(e) => setTelemetry({ gas_ppm: parseFloat(e.target.value) })}
                      className="w-full accent-purple-500 cursor-pointer"
                    />
                  </div>

                  {/* Current Draw Slider */}
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-cyan-400">Pump Current Draw:</span>
                      <span className="font-mono text-white">{telemetry.current_draw.toFixed(2)} A</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="5.0"
                      step="0.05"
                      value={telemetry.current_draw}
                      onChange={(e) => setTelemetry({ current_draw: parseFloat(e.target.value) })}
                      className="w-full accent-cyan-500 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Actuator Toggles */}
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <button
                    onClick={() => setTelemetry({ pump_active: !telemetry.pump_active })}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition border cursor-pointer ${
                      telemetry.pump_active
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    Pump: {telemetry.pump_active ? 'ON' : 'OFF'}
                  </button>
                  <button
                    onClick={() => setTelemetry({ valve_open: !telemetry.valve_open })}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition border cursor-pointer ${
                      telemetry.valve_open
                        ? 'bg-purple-600 text-white border-purple-500'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    Valve: {telemetry.valve_open ? 'OPEN' : 'CLOSED'}
                  </button>
                  <button
                    onClick={() => setTelemetry({ fan_active: !telemetry.fan_active })}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition border cursor-pointer ${
                      telemetry.fan_active
                        ? 'bg-amber-600 text-white border-amber-500'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    Fan: {telemetry.fan_active ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-950 text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              Telemetry Continuous Stream: <strong>{streamHz} Hz Active (Auto-Sequenced)</strong>
            </span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-semibold transition border border-slate-700 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
