import React from 'react';
import {
  BrainCircuit,
  X,
  Wifi,
  WifiOff,
  AlertTriangle,
  Activity,
  Gauge,
  TrendingUp,
  Wind,
  Bell,
} from 'lucide-react';
import type { BackendPredictionsState } from '../../hooks/useBackendPredictions';
import type { AlertSeverity, ForecastEntry } from '../../types/predictions';

const FAULT_NAMES: Record<string, string> = {
  normal: 'Normal operation',
  gas_leak: 'Gas leak',
  overheating: 'Overheating',
  dry_run: 'Dry run / cavitation',
  line_blockage: 'Line blockage',
  motor_overload: 'Motor overload',
  tank_leak: 'Tank leak',
  stuck_relay: 'Stuck pump relay',
  valve_stuck: 'Drain valve stuck',
};

const SEVERITY_STYLES: Record<AlertSeverity, string> = {
  critical: 'bg-red-50 text-red-800 border-red-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  info: 'bg-sky-50 text-sky-800 border-sky-200',
};

const FORECAST_ROWS: { key: 'tank_level' | 'temperature' | 'gas_ppm'; label: string; unit: string }[] = [
  { key: 'tank_level', label: 'Tank level', unit: '%' },
  { key: 'temperature', label: 'Temperature', unit: '°C' },
  { key: 'gas_ppm', label: 'Gas', unit: 'ppm' },
];

function formatEta(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds === 0) return 'now';
  return seconds < 120 ? `${Math.round(seconds)} s` : `${(seconds / 60).toFixed(1)} min`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const Section: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({
  icon,
  title,
  children,
}) => (
  <div className="border border-gray-200 rounded-lg p-3 space-y-2">
    <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-slate-600 uppercase">
      {icon}
      <span>{title}</span>
    </div>
    {children}
  </div>
);

const ForecastRow: React.FC<{ label: string; unit: string; entry: ForecastEntry }> = ({ label, unit, entry }) => {
  const soon = entry.eta_trip_s !== null && entry.eta_trip_s <= 120;
  return (
    <tr className={soon ? 'text-red-700 font-semibold' : 'text-slate-700'}>
      <td className="py-0.5">{label}</td>
      <td className="text-right font-mono">{entry.value.toFixed(1)}{unit}</td>
      <td className="text-right font-mono">
        {entry.rate_per_min > 0 ? '+' : ''}
        {entry.rate_per_min.toFixed(1)}/min
      </td>
      <td className="text-right font-mono">{entry.predicted.toFixed(1)}</td>
      <td className="text-right font-mono">{formatEta(entry.eta_trip_s)}</td>
    </tr>
  );
};

export const PredictiveAnalyticsPanel: React.FC<{ data: BackendPredictionsState; onClose?: () => void }> = ({
  data,
  onClose,
}) => {
  const { connected, predictions, alerts, events, models } = data;
  const anomaly = predictions?.anomaly;
  const fault = predictions?.fault;
  const health = predictions?.pump_health;
  const gas = predictions?.gas;
  const forecast = predictions?.forecast;

  return (
    <div className="fixed left-3 right-3 sm:left-auto sm:right-3 sm:w-[26rem] top-[52px] sm:top-[98px] max-h-[calc(100vh-120px)] sm:max-h-[calc(100vh-8rem)] overflow-y-auto bg-white/95 backdrop-blur-md border border-gray-200 rounded-2xl shadow-xl p-4 z-20 flex flex-col space-y-3 text-xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-gray-100">
        <div className="flex items-center space-x-1.5">
          <BrainCircuit className="w-4 h-4 text-violet-600" />
          <span className="font-bold text-slate-800">Predictive Analytics</span>
          {models && (
            <span className="text-[10px] font-mono bg-violet-50 text-violet-700 border border-violet-200 px-1.5 rounded">
              {models.profile}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <span className={`flex items-center space-x-1 text-[10px] font-semibold ${connected ? 'text-emerald-600' : 'text-red-600'}`}>
            {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span>{connected ? 'Bridge live' : 'Bridge offline'}</span>
          </span>
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
      </div>

      {!connected && (
        <div className="px-3 py-2 rounded-lg border bg-gray-50 text-gray-600 border-gray-200">
          Start the bridge (<code>python backend/server.py</code>) and a telemetry source: the 3D simulation, the
          LabVIEW feeder sim, or the real rig via LabVIEW.
        </div>
      )}

      {/* Active alerts */}
      <Section icon={<Bell className="w-3.5 h-3.5" />} title={`Active alerts (${alerts.length})`}>
        {alerts.length === 0 ? (
          <div className="text-emerald-700">No active alerts.</div>
        ) : (
          <ul className="space-y-1.5">
            {alerts.map((alert) => (
              <li key={alert.alert_id} className={`px-2 py-1.5 rounded-md border ${SEVERITY_STYLES[alert.severity]}`}>
                <div className="flex justify-between font-semibold">
                  <span>{alert.kind}</span>
                  <span className="font-mono text-[10px]">since {formatTime(alert.raised_at)}</span>
                </div>
                <div>{alert.message}</div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {predictions === null && connected && (
        <div className="px-3 py-2 rounded-lg border bg-amber-50 text-amber-800 border-amber-200">
          Telemetry is invalid or not arriving, so there are no predictions. Check the sensors and the bridge feed.
        </div>
      )}

      {predictions && (
        <>
          {/* Anomaly */}
          <Section icon={<Activity className="w-3.5 h-3.5" />} title={`Anomaly detection · ${predictions.operating_mode}`}>
            {anomaly?.detected === null || anomaly === undefined ? (
              <div className="text-gray-500">Warming up (needs a few samples in this mode) or no model trained.</div>
            ) : (
              <>
                <div className={`font-semibold ${anomaly.detected ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {anomaly.detected ? 'Unusual plant behaviour' : 'Behaviour matches normal operation'}
                </div>
                <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                  <div>Envelope: {anomaly.envelope_score?.toFixed(2) ?? '—'}</div>
                  <div>Isolation Forest: {anomaly.iforest_score?.toFixed(3) ?? '—'}</div>
                </div>
                <div className="text-[10px] text-gray-500">Scores above 0 are anomalous.</div>
              </>
            )}
          </Section>

          {/* Fault diagnosis */}
          <Section icon={<AlertTriangle className="w-3.5 h-3.5" />} title="Fault diagnosis">
            {!fault ? (
              <div className="text-gray-500">Collecting a window of samples… (or no classifier trained)</div>
            ) : (
              <>
                <div className={`font-semibold ${fault.label === 'normal' ? 'text-emerald-700' : 'text-red-700'}`}>
                  {FAULT_NAMES[fault.label] ?? fault.label} · {(fault.confidence * 100).toFixed(0)}%
                </div>
                <div className="space-y-1">
                  {Object.entries(fault.probabilities).map(([label, p]) => (
                    <div key={label} className="flex items-center space-x-2">
                      <span className="w-32 truncate">{FAULT_NAMES[label] ?? label}</span>
                      <div className="flex-1 h-1.5 bg-gray-100 rounded">
                        <div className="h-1.5 rounded bg-violet-500" style={{ width: `${p * 100}%` }} />
                      </div>
                      <span className="w-9 text-right font-mono">{(p * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Section>

          {/* Pump health */}
          <Section icon={<Gauge className="w-3.5 h-3.5" />} title="Pump health">
            {!health ? (
              <div className="text-gray-500">Estimated once the pump has run for a full window.</div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span
                    className={`font-semibold ${
                      health.label === 'GOOD' ? 'text-emerald-700' : health.label === 'DEGRADING' ? 'text-amber-700' : 'text-red-700'
                    }`}
                  >
                    {health.label}
                  </span>
                  <span className="font-mono font-bold text-slate-800">{health.health.toFixed(0)}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded">
                  <div
                    className={`h-2 rounded ${
                      health.health >= 70 ? 'bg-emerald-500' : health.health >= 40 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${health.health}%` }}
                  />
                </div>
                <div className="text-[10px] text-gray-500">Last estimated {formatTime(health.updated_at)}</div>
              </>
            )}
          </Section>

          {/* Gas calibration */}
          <Section icon={<Wind className="w-3.5 h-3.5" />} title="MQ-2 gas calibration">
            {!gas ? (
              <div className="text-gray-500">Needs the raw MQ-2 output (register 40009) from the rig or feeder sim.</div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[10px] text-gray-500">Calibrated ({gas.method})</div>
                  <div className="font-mono font-bold text-slate-800">{gas.ppm_calibrated.toFixed(1)} ppm</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500">Uncompensated</div>
                  <div className="font-mono text-slate-700">{gas.ppm_uncompensated.toFixed(1)} ppm</div>
                </div>
                <div className="col-span-2 text-[10px] text-gray-500">
                  Rs/R0 {gas.rs_r0_ratio.toFixed(2)} ·{' '}
                  {gas.compensated ? 'temperature/humidity compensated (BME280)' : 'no BME280 data: reference 20 °C / 33 %RH assumed'}
                </div>
              </div>
            )}
          </Section>

          {/* Forecast */}
          <Section icon={<TrendingUp className="w-3.5 h-3.5" />} title={`Forecast · next ${forecast?.horizon_s ?? 60} s`}>
            {!forecast ? (
              <div className="text-gray-500">Needs about 5 s of continuous data.</div>
            ) : (
              <table className="w-full text-[11px]">
                <thead className="text-[10px] text-gray-500">
                  <tr>
                    <th className="text-left font-medium">Signal</th>
                    <th className="text-right font-medium">Now</th>
                    <th className="text-right font-medium">Trend</th>
                    <th className="text-right font-medium">In {forecast.horizon_s} s</th>
                    <th className="text-right font-medium">Trip in</th>
                  </tr>
                </thead>
                <tbody>
                  {FORECAST_ROWS.map((row) => (
                    <ForecastRow key={row.key} label={row.label} unit={row.unit} entry={forecast[row.key]} />
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        </>
      )}

      {/* Event log */}
      <Section icon={<Bell className="w-3.5 h-3.5" />} title="Detection log">
        {events.length === 0 ? (
          <div className="text-gray-500">No detections logged yet. Full history: backend/data/events.csv</div>
        ) : (
          <ul className="space-y-1 max-h-40 overflow-y-auto font-mono text-[10px]">
            {events.map((event) => (
              <li key={`${event.alert_id}-${event.event}`} className="flex space-x-2">
                <span className="text-gray-500">{formatTime(event.timestamp)}</span>
                <span className={event.event === 'raised' ? 'text-red-700' : 'text-emerald-700'}>{event.event}</span>
                <span className="truncate text-slate-700">{event.kind}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {models && (
        <div className="text-[10px] text-gray-400">
          Models: envelope {models.anomaly_envelope ? '✓' : '✗'} · iforest {models.anomaly_iforest ? '✓' : '✗'} · fault{' '}
          {models.fault_classifier ? '✓' : '✗'} · pump {models.pump_health ? '✓' : '✗'} · gas {models.gas_calibration}. Advisory
          only: safety interlocks stay rule-based.
        </div>
      )}
    </div>
  );
};
