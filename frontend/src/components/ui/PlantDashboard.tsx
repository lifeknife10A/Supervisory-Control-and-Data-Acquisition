import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Bot,
  CircleCheck,
  CircleHelp,
  Clock,
  Hand,
  LayoutDashboard,
  OctagonAlert,
  Power,
  TriangleAlert,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useWorkbenchStore } from '../../store/workbenchStore';
import { usePlantLive, sendBridgeCommand } from '../../hooks/usePlantLive';
import type { ActuatorKey, PlantLiveState, PlantSample, ControlResult } from '../../hooks/usePlantLive';
import { DEVICES, METRICS, formatValue, metricLevel, metricValue } from './plantDevices';
import type { DeviceDef, Level, MetricDef } from './plantDevices';

const LEVEL_STYLE: Record<Level, { pill: string; icon: React.ReactNode; label: string }> = {
  ok: { pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CircleCheck className="w-3 h-3" />, label: 'Normal' },
  warning: { pill: 'bg-amber-50 text-amber-800 border-amber-200', icon: <TriangleAlert className="w-3 h-3" />, label: 'Warning' },
  critical: { pill: 'bg-red-50 text-red-700 border-red-200', icon: <OctagonAlert className="w-3 h-3" />, label: 'Trip' },
  missing: { pill: 'bg-slate-50 text-slate-500 border-slate-200', icon: <CircleHelp className="w-3 h-3" />, label: 'No data' },
};

const PLANT_LEVEL: Level[] = ['ok', 'warning', 'critical'];
const ACTUATOR_SIM_NAME = { pump_active: 'pump', valve_open: 'valve', fan_active: 'fan' } as const;
const PENDING_TIMEOUT_MS = 10000;

const LevelPill: React.FC<{ level: Level; label?: string }> = ({ level, label }) => (
  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-semibold ${LEVEL_STYLE[level].pill}`}>
    {LEVEL_STYLE[level].icon}
    {label ?? LEVEL_STYLE[level].label}
  </span>
);

function deviceLevel(device: DeviceDef, sample: PlantSample | null): Level {
  if (device.kind === 'controller') return sample ? (sample.data_valid ? PLANT_LEVEL[sample.status_class] : 'critical') : 'missing';
  if (device.kind === 'actuator') return sample ? 'ok' : 'missing';
  const levels = device.metrics.map((key) => metricLevel(METRICS[key], metricValue(sample, key)));
  for (const level of ['critical', 'warning', 'ok'] as Level[]) if (levels.includes(level)) return level;
  return 'missing';
}

function series(history: PlantSample[], key: keyof PlantSample): { t: number; v: number }[] {
  return history.flatMap((s) => (typeof s[key] === 'number' ? [{ t: s.t, v: s[key] as number }] : []));
}

/** Change per minute over the last ~10 s of samples. */
function ratePerMinute(points: { t: number; v: number }[]): number | null {
  if (points.length < 4) return null;
  const last = points[points.length - 1];
  const first = points.find((p) => last.t - p.t <= 10000) ?? points[0];
  const dt = (last.t - first.t) / 60000;
  return dt > 0 ? (last.v - first.v) / dt : null;
}

// ---------------------------------------------------------------------------------------------
// Charts

const Sparkline: React.FC<{ points: { t: number; v: number }[] }> = ({ points }) => {
  if (points.length < 2) return <div className="h-8" />;
  const vs = points.map((p) => p.v);
  const lo = Math.min(...vs);
  const hi = Math.max(...vs);
  const span = hi - lo || 1;
  const t0 = points[0].t;
  const tSpan = points[points.length - 1].t - t0 || 1;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${((p.t - t0) / tSpan) * 100},${28 - ((p.v - lo) / span) * 24}`).join(' ');
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-8" aria-hidden="true">
      <path d={d} fill="none" stroke="#0284c7" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
};

const TrendChart: React.FC<{ metric: MetricDef; points: { t: number; v: number }[] }> = ({ metric, points }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) {
    return <div className="h-36 flex items-center justify-center text-[11px] text-slate-400 border border-dashed border-slate-200 rounded-lg">Collecting samples…</div>;
  }
  const vs = points.map((p) => p.v);
  let lo = Math.min(...vs);
  let hi = Math.max(...vs);
  const pad = Math.max((hi - lo) * 0.15, Math.abs(hi) * 0.02, 10 ** -metric.decimals);
  lo -= pad;
  hi += pad;
  const t0 = points[0].t;
  const tSpan = points[points.length - 1].t - t0 || 1;
  const x = (t: number) => ((t - t0) / tSpan) * 100;
  const y = (v: number) => 100 - ((v - lo) / (hi - lo)) * 100;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t)},${y(p.v)}`).join(' ');
  const limits = [
    { v: metric.warnLow, color: '#d97706', label: 'low warn' },
    { v: metric.warnHigh, color: '#d97706', label: 'warn' },
    { v: metric.tripHigh, color: '#dc2626', label: 'trip' },
  ].filter((l): l is { v: number; color: string; label: string } => l.v !== undefined && l.v > lo && l.v < hi);
  const hovered = hover === null ? null : points[hover];

  const onMove = (e: React.PointerEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const target = t0 + ((e.clientX - rect.left) / rect.width) * tSpan;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(p.t - target) < Math.abs(points[best].t - target)) best = i;
    });
    setHover(best);
  };

  return (
    <div>
      <div className="flex">
        <div className="flex flex-col justify-between text-[10px] font-mono text-slate-400 pr-1.5 h-36 text-right w-12 shrink-0">
          <span>{hi.toFixed(metric.decimals)}</span>
          <span>{lo.toFixed(metric.decimals)}</span>
        </div>
        <div
          ref={ref}
          className="relative flex-1 h-36 border-l border-b border-slate-200 cursor-crosshair touch-none"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" role="img"
               aria-label={`${metric.label} over the last ${Math.round(tSpan / 1000)} seconds`}>
            {limits.map((l) => (
              <line key={l.label} x1={0} x2={100} y1={y(l.v)} y2={y(l.v)} stroke={l.color} strokeWidth={1}
                    strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
            ))}
            <path d={d} fill="none" stroke="#0284c7" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            {hovered && (
              <line x1={x(hovered.t)} x2={x(hovered.t)} y1={0} y2={100} stroke="#94a3b8" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            )}
          </svg>
          {limits.map((l) => (
            <span key={l.label} className="absolute right-1 -translate-y-full text-[9px] font-semibold text-slate-500 bg-white/80 px-0.5"
                  style={{ top: `${y(l.v)}%` }}>
              {l.label} {l.v}
            </span>
          ))}
          {hovered && (
            <>
              <span className="absolute w-2.5 h-2.5 rounded-full bg-sky-600 ring-2 ring-white -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ left: `${x(hovered.t)}%`, top: `${y(hovered.v)}%` }} />
              <div className={`absolute top-1 px-2 py-1 rounded-md bg-slate-900 text-white text-[10px] font-mono pointer-events-none whitespace-nowrap ${x(hovered.t) > 60 ? '-translate-x-full -ml-2' : 'ml-2'}`}
                   style={{ left: `${x(hovered.t)}%` }}>
                {hovered.v.toFixed(metric.decimals)} {metric.unit} · {Math.round((points[points.length - 1].t - hovered.t) / 1000)} s ago
              </div>
            </>
          )}
        </div>
      </div>
      <div className="flex justify-between text-[10px] text-slate-400 pl-[3.375rem] pt-0.5">
        <span>−{Math.round(tSpan / 1000)} s</span>
        <span>now</span>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------------------------
// Cards

interface ActuateProps {
  onActuate: (key: ActuatorKey, value: boolean) => void;
  pending: { key: ActuatorKey; value: boolean } | null;
  canControl: boolean;
}

const ActuatorSwitch: React.FC<ActuateProps & { actuator: ActuatorKey; on: boolean; large?: boolean }> = ({
  actuator, on, onActuate, pending, canControl, large,
}) => {
  const waiting = pending?.key === actuator;
  const size = large ? 'px-4 py-2 text-sm' : 'px-2.5 py-1 text-[11px]';
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5" role="group" aria-label="Manual control">
      {[true, false].map((value) => {
        const active = on === value;
        return (
          <button
            key={String(value)}
            type="button"
            disabled={!canControl || waiting}
            onClick={(e) => {
              e.stopPropagation();
              if (!active) onActuate(actuator, value);
            }}
            className={`${size} rounded-md font-bold transition disabled:opacity-50 disabled:cursor-not-allowed ${
              active ? (value ? 'bg-sky-600 text-white shadow-xs' : 'bg-white text-slate-800 shadow-xs border border-slate-200') : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {waiting && pending?.value === value ? '…' : value ? 'ON' : 'OFF'}
          </button>
        );
      })}
    </div>
  );
};

const DeviceCard: React.FC<{
  device: DeviceDef;
  live: PlantLiveState;
  selected: boolean;
  onSelect: () => void;
} & ActuateProps> = ({ device, live, selected, onSelect, ...actuate }) => {
  const { sample, history } = live;
  const Icon = device.icon;
  const level = deviceLevel(device, sample);
  const primary = device.metrics[0] ? METRICS[device.metrics[0]] : null;
  const value = primary ? metricValue(sample, primary.key) : null;
  const on = device.actuator && sample ? sample[device.actuator] : false;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect())}
      className={`text-left bg-white border rounded-xl p-3.5 flex flex-col gap-2 cursor-pointer transition hover:border-sky-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
        selected ? 'border-sky-500 ring-1 ring-sky-500 shadow-md' : 'border-slate-200 shadow-xs'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${device.actuator && on ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
            <Icon className={`w-4 h-4 ${device.id === 'fan' && on ? 'animate-spin [animation-duration:1.5s]' : ''}`} />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-800 truncate">{device.name}</div>
            <div className="text-[11px] text-slate-500 truncate">{device.part}</div>
          </div>
        </div>
        {device.kind === 'sensor' && <LevelPill level={level} />}
        {device.kind === 'controller' && <LevelPill level={level} label={sample?.health_label ?? undefined} />}
      </div>

      {device.kind === 'sensor' && primary && (
        <>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">{formatValue(primary, value)}</span>
            <span className="text-xs text-slate-500">{value === null ? '' : primary.unit}</span>
            {device.metrics.slice(1).map((key) => (
              <span key={key} className="ml-auto text-[11px] text-slate-500 font-mono">
                {formatValue(METRICS[key], metricValue(sample, key))} {METRICS[key].unit}
              </span>
            ))}
          </div>
          {value === null ? (
            <div className="h-8 text-[11px] text-slate-400 flex items-center">Not reported by the current source</div>
          ) : (
            <Sparkline points={series(history, primary.key).slice(-60)} />
          )}
        </>
      )}

      {device.kind === 'actuator' && device.actuator && (
        <div className="flex items-center justify-between gap-2 mt-auto">
          <span className={`text-lg font-bold ${on ? 'text-sky-700' : 'text-slate-400'}`}>{sample ? (on ? 'Running' : 'Off') : '—'}</span>
          <ActuatorSwitch actuator={device.actuator} on={Boolean(on)} {...actuate} />
        </div>
      )}

      {device.kind === 'controller' && (
        <div className="text-[11px] text-slate-600 line-clamp-2 min-h-8">
          {sample?.recommendation ?? (live.source === 'simulation' ? '3D simulation running locally (bridge offline).' : 'Waiting for telemetry.')}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------------------------
// Detail drawer

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="bg-slate-50 rounded-lg px-2.5 py-1.5">
    <div className="text-[10px] text-slate-500 uppercase font-semibold">{label}</div>
    <div className="text-xs font-mono font-semibold text-slate-800 tabular-nums">{value}</div>
  </div>
);

const MetricDetail: React.FC<{ metric: MetricDef; live: PlantLiveState }> = ({ metric, live }) => {
  const points = series(live.history, metric.key);
  const value = metricValue(live.sample, metric.key);
  const rate = ratePerMinute(points);
  const vs = points.map((p) => p.v);
  const fmt = (v: number | null) => (v === null ? '—' : `${v.toFixed(metric.decimals)}`);
  const limits = [
    metric.warnLow !== undefined && `low warning ≤ ${metric.warnLow}`,
    metric.warnHigh !== undefined && `warning ≥ ${metric.warnHigh}`,
    metric.tripHigh !== undefined && `trip ≥ ${metric.tripHigh}`,
  ].filter(Boolean);

  return (
    <section className="space-y-2">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[11px] font-semibold text-slate-500 uppercase">{metric.label}</div>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold font-mono text-slate-900 tabular-nums">{formatValue(metric, value)}</span>
            <span className="text-sm text-slate-500">{value === null ? '' : metric.unit}</span>
          </div>
        </div>
        <LevelPill level={metricLevel(metric, value)} />
      </div>
      {value === null ? (
        <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
          This reading is not reported by the current source. It appears once the sensor is wired and LabVIEW forwards it.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-1.5">
            <Stat label="Min" value={fmt(vs.length ? Math.min(...vs) : null)} />
            <Stat label="Avg" value={fmt(vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null)} />
            <Stat label="Max" value={fmt(vs.length ? Math.max(...vs) : null)} />
            <Stat label="Rate/min" value={rate === null ? '—' : `${rate > 0 ? '+' : ''}${rate.toFixed(metric.decimals)}`} />
          </div>
          <TrendChart metric={metric} points={points} />
          {limits.length > 0 && <div className="text-[11px] text-slate-500">Bridge limits: {limits.join(' · ')} {metric.unit}</div>}
        </>
      )}
    </section>
  );
};

function onTimeSummary(history: PlantSample[], key: ActuatorKey) {
  if (history.length === 0) return null;
  const onCount = history.filter((s) => s[key]).length;
  const current = history[history.length - 1][key];
  let since = history[0].t;
  for (let i = history.length - 1; i > 0; i--) {
    if (history[i - 1][key] !== current) {
      since = history[i].t;
      break;
    }
  }
  return { percent: Math.round((onCount / history.length) * 100), since, strip: history.slice(-80).map((s) => s[key]) };
}

const MLInsight: React.FC<{ device: DeviceDef; sample: PlantSample | null }> = ({ device, sample }) => {
  const p = sample?.predictions;
  if (!p) return null;
  const rows: [string, string][] = [];
  const forecastKey = device.id === 'level' ? 'tank_level' : device.id === 'temperature' ? 'temperature' : device.id === 'gas' ? 'gas_ppm' : null;
  const f = forecastKey && p.forecast ? p.forecast[forecastKey] : null;
  if (f) {
    rows.push([`Forecast in ${Math.round((p.forecast?.horizon_s ?? 0) / 60)} min`, f.predicted.toFixed(1)]);
    if (f.eta_trip_s !== null) rows.push(['Time to trip limit', `${Math.round(f.eta_trip_s)} s`]);
  }
  if ((device.id === 'current' || device.id === 'pump') && p.pump_health) {
    rows.push(['Pump health', `${p.pump_health.health.toFixed(0)} / 100 (${p.pump_health.label})`]);
  }
  if ((device.id === 'current' || device.id === 'pump') && p.fault) {
    rows.push(['Fault classifier', `${p.fault.label.replace(/_/g, ' ')} (${Math.round(p.fault.confidence * 100)}%)`]);
  }
  if (device.id === 'gas' && p.gas) {
    rows.push(['Calibrated (T/RH compensated)', `${p.gas.ppm_calibrated.toFixed(0)} ppm`]);
    rows.push(['Rs/R0', p.gas.rs_r0_ratio.toFixed(2)]);
  }
  if (device.id === 'controller') {
    rows.push(['Operating mode', p.operating_mode]);
    if (p.anomaly.score !== null) rows.push(['Anomaly score', `${p.anomaly.score.toFixed(2)}${p.anomaly.detected ? ' (anomalous)' : ''}`]);
  }
  if (rows.length === 0) return null;
  return (
    <section className="border border-violet-200 bg-violet-50/50 rounded-lg p-3">
      <div className="text-[11px] font-semibold text-violet-700 uppercase mb-1.5">ML insight (advisory)</div>
      <dl className="space-y-1 text-xs">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-slate-600">{k}</dt>
            <dd className="font-mono font-semibold text-slate-800 text-right">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
};

const DetailDrawer: React.FC<{
  device: DeviceDef;
  live: PlantLiveState;
  onClose: () => void;
  feedback: ControlResult | null;
} & ActuateProps> = ({ device, live, onClose, feedback, ...actuate }) => {
  const { sample, history } = live;
  const Icon = device.icon;
  const summary = device.actuator ? onTimeSummary(history, device.actuator) : null;
  const on = device.actuator && sample ? sample[device.actuator] : false;
  // sample.t is the time of the latest poll, so this ages while telemetry is stale.
  const ageS = live.lastUpdate && sample ? Math.max(0, Math.round((sample.t - live.lastUpdate) / 1000)) : null;

  return (
    <aside className="fixed inset-0 z-[36] sm:static sm:z-auto sm:w-[30rem] sm:shrink-0 bg-white border-l border-slate-200 shadow-2xl sm:shadow-none flex flex-col"
           aria-label={`${device.name} details`}>
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center shrink-0"><Icon className="w-5 h-5" /></span>
          <div className="min-w-0">
            <div className="font-bold text-slate-900 truncate">{device.name}</div>
            <div className="text-xs text-slate-500 truncate">{device.part}</div>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg" title="Close (Esc)">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <p className="text-xs text-slate-600">{device.senses}</p>

        {device.actuator && (
          <section className="border border-slate-200 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold text-slate-500 uppercase">Output state</div>
                <div className={`text-2xl font-bold ${on ? 'text-sky-700' : 'text-slate-400'}`}>{sample ? (on ? 'Running' : 'Off') : '—'}</div>
              </div>
              <ActuatorSwitch actuator={device.actuator} on={Boolean(on)} large {...actuate} />
            </div>
            {feedback && (
              <div className={`text-xs rounded-md px-2.5 py-1.5 border ${feedback.ok ? 'bg-sky-50 border-sky-200 text-sky-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                {feedback.message}
              </div>
            )}
            {!actuate.canControl && <div className="text-xs text-slate-500">No plant connected: start the bridge or the 3D simulation to control outputs.</div>}
            {summary && (
              <>
                <div className="grid grid-cols-2 gap-1.5">
                  <Stat label="On time (window)" value={`${summary.percent}%`} />
                  <Stat label={on ? 'On since' : 'Off since'} value={new Date(summary.since).toLocaleTimeString()} />
                </div>
                <div>
                  <div className="flex h-3 rounded overflow-hidden gap-px bg-white" aria-label="Recent on/off history">
                    {summary.strip.map((v, i) => (
                      <span key={i} className={`flex-1 ${v ? 'bg-sky-600' : 'bg-slate-200'}`} />
                    ))}
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 pt-0.5"><span>older</span><span>now</span></div>
                </div>
              </>
            )}
            <div className="text-[11px] text-slate-500">
              Safety interlocks always win: the bridge and the firmware override manual commands during a trip.
            </div>
          </section>
        )}

        {device.metrics.map((key) => <MetricDetail key={key} metric={METRICS[key]} live={live} />)}

        {device.kind === 'controller' && (
          <section className="space-y-2">
            <div className="grid grid-cols-2 gap-1.5">
              <Stat label="Source" value={live.source === 'bridge' ? 'Bridge' : live.source === 'simulation' ? '3D simulation' : 'Offline'} />
              <Stat label="Last update" value={ageS === null ? '—' : `${ageS} s ago${live.stale ? ' (stale)' : ''}`} />
              <Stat label="Data valid" value={sample ? (sample.data_valid ? 'Yes' : 'No — fail-safe') : '—'} />
              <Stat label="Status" value={sample?.health_label ?? '—'} />
            </div>
            {sample?.recommendation && <p className="text-xs text-slate-700 bg-slate-50 rounded-lg p-2.5">{sample.recommendation}</p>}
            {sample && sample.alerts.length > 0 && (
              <ul className="space-y-1">
                {sample.alerts.map((a) => (
                  <li key={a.alert_id} className="text-xs border border-amber-200 bg-amber-50 text-amber-900 rounded-md px-2 py-1">
                    <span className="font-semibold">{a.kind}</span> — {a.message}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <MLInsight device={device} sample={sample} />

        <section className="text-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase mb-1">Wiring</div>
          <div className="font-mono text-slate-700 bg-slate-50 rounded-lg px-2.5 py-1.5">{device.wiring}</div>
        </section>
      </div>
    </aside>
  );
};

// ---------------------------------------------------------------------------------------------
// Dashboard

export const PlantDashboard: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const live = usePlantLive();
  const { sample, source } = live;
  const isSimulating = useWorkbenchStore((s) => s.isSimulating);
  const controlMode = useWorkbenchStore((s) => s.controlMode);
  const setControlMode = useWorkbenchStore((s) => s.setControlMode);
  const setActuatorState = useWorkbenchStore((s) => s.setActuatorState);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ key: ActuatorKey; value: boolean; since: number } | null>(null);
  const [feedback, setFeedback] = useState<ControlResult | null>(null);
  const selected = DEVICES.find((d) => d.id === selectedId) ?? null;
  const canControl = isSimulating || live.bridgeConnected;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (selectedId) setSelectedId(null);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, onClose]);

  // A command is pending until the plant reports the new state (or it times out).
  useEffect(() => {
    if (!pending || !sample) return;
    if (sample[pending.key] === pending.value) {
      setPending(null);
    } else if (Date.now() - pending.since > PENDING_TIMEOUT_MS) {
      setPending(null);
      setFeedback({ ok: false, message: 'Not confirmed by the plant within 10 s. Check that LabVIEW is running, or a safety interlock is holding the output.' });
    }
  }, [sample, pending]);

  const actuate = async (key: ActuatorKey, value: boolean) => {
    if (isSimulating) {
      // The 3D simulation's auto PLC logic would immediately undo a manual change.
      if (controlMode !== 'manual') setControlMode('manual');
      setActuatorState(ACTUATOR_SIM_NAME[key], value);
      setFeedback({ ok: true, message: controlMode === 'manual' ? 'Applied to the 3D simulation.' : 'Simulation switched to manual mode and command applied.' });
      return;
    }
    setPending({ key, value, since: Date.now() });
    const result = await sendBridgeCommand(key, value);
    setFeedback(result);
    if (!result.ok) setPending(null);
  };

  const plantLevel: Level = !sample ? 'missing' : !sample.data_valid ? 'critical' : PLANT_LEVEL[sample.status_class];
  const plantLabel = !sample ? 'No data' : sample.health_label ?? LEVEL_STYLE[plantLevel].label;
  const actuateProps: ActuateProps = { onActuate: actuate, pending, canControl };
  const groups = useMemo(() => [
    { title: 'Sensors', items: DEVICES.filter((d) => d.kind === 'sensor') },
    { title: 'Actuators', items: DEVICES.filter((d) => d.kind === 'actuator') },
    { title: 'Controller', items: DEVICES.filter((d) => d.kind === 'controller') },
  ], []);

  return (
    <div className="fixed inset-0 z-[35] bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5 text-sky-600" />
          <h1 className="font-bold text-slate-900">Plant Dashboard</h1>
        </div>
        <LevelPill level={plantLevel} label={plantLabel} />
        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
          source === 'bridge' && !live.stale ? 'text-emerald-600' : source === 'simulation' ? 'text-sky-600' : 'text-red-600'}`}>
          {source === 'offline' ? <WifiOff className="w-3.5 h-3.5" /> : source === 'simulation' ? <Activity className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
          {source === 'bridge'
            ? (live.stale ? 'Bridge online · no telemetry' : isSimulating ? 'Bridge · 3D simulation' : 'Bridge · LabVIEW')
            : source === 'simulation' ? 'Local 3D simulation (bridge offline)' : 'Offline'}
        </span>
        {isSimulating && (
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[11px]" role="group" aria-label="Simulation control mode">
            {([['auto', 'Auto', Bot], ['manual', 'Manual', Hand]] as const).map(([mode, label, ModeIcon]) => (
              <button key={mode} onClick={() => setControlMode(mode)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold ${
                  controlMode === mode ? 'bg-white text-slate-900 shadow-xs border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                <ModeIcon className="w-3 h-3" />{label}
              </button>
            ))}
          </div>
        )}
        <button onClick={onClose} className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100">
          <X className="w-3.5 h-3.5" /> Back to 3D
        </button>
      </header>

      <div className="flex-1 flex min-h-0">
      <main className="flex-1 min-w-0 overflow-y-auto p-4 space-y-5">
        {sample?.recommendation && plantLevel !== 'ok' && (
          <div className={`flex items-start gap-2 text-xs rounded-lg border px-3 py-2 ${LEVEL_STYLE[plantLevel].pill}`}>
            {LEVEL_STYLE[plantLevel].icon}<span>{sample.recommendation}</span>
          </div>
        )}
        {source === 'offline' && (
          <div className="text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-600">
            Nothing to show yet. Start the bridge (<code>python -m uvicorn server:app --port 8000</code> in <code>backend/</code>) with LabVIEW
            and the ESP32, or start the 3D simulation.
          </div>
        )}
        {groups.map((group) => (
          <section key={group.title}>
            <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">{group.title}</h2>
            <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))]">
              {group.items.map((device) => (
                <DeviceCard key={device.id} device={device} live={live} selected={device.id === selectedId}
                  onSelect={() => setSelectedId(device.id === selectedId ? null : device.id)} {...actuateProps} />
              ))}
            </div>
          </section>
        ))}
        <div className="flex items-center gap-1 text-[11px] text-slate-400">
          <Clock className="w-3 h-3" /> Updates every 0.5 s · trends keep the last 2 minutes · click a card for live vitals
          <Power className="w-3 h-3 ml-2" /> manual commands go through the bridge's safety interlocks
        </div>
      </main>

      {selected && (
        <DetailDrawer device={selected} live={live} onClose={() => setSelectedId(null)} feedback={feedback} {...actuateProps} />
      )}
      </div>
    </div>
  );
};
