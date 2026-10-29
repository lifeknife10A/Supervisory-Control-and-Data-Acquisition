import { useEffect, useRef, useState } from 'react';
import { BACKEND_URL } from '../constants/backend';
import { useWorkbenchStore } from '../store/workbenchStore';
import type { MLAlert, Predictions } from '../types/predictions';

const POLL_MS = 500;
const HISTORY_SIZE = 240; // 2 minutes at 500 ms
const STALE_MS = 5000;

/** One plant reading, from the bridge (LabVIEW / ESP32 / feeder) or the local 3D simulation. */
export interface PlantSample {
  t: number;
  tank_level: number;
  temperature: number;
  gas_ppm: number;
  current_draw: number;
  pump_active: boolean;
  valve_open: boolean;
  fan_active: boolean;
  status_class: 0 | 1 | 2;
  health_label: string | null;
  recommendation: string | null;
  data_valid: boolean;
  ambient_temp: number | null;
  humidity: number | null;
  pressure_hpa: number | null;
  supply_voltage: number | null;
  gas_sensor_mv: number | null;
  predictions: Predictions | null;
  alerts: MLAlert[];
}

export type PlantSource = 'bridge' | 'simulation' | 'offline';

export interface PlantLiveState {
  source: PlantSource;
  bridgeConnected: boolean;
  /** Bridge reachable but nothing has posted telemetry for STALE_MS. */
  stale: boolean;
  lastUpdate: number | null;
  sample: PlantSample | null;
  history: PlantSample[];
}

interface BridgeState extends Partial<Omit<PlantSample, 't'>> {
  timestamp?: string;
}

function fromBridge(data: BridgeState, t: number): PlantSample | null {
  // Before the first telemetry post the bridge holds nulls for every reading.
  if (typeof data.tank_level !== 'number') return null;
  return {
    t,
    tank_level: data.tank_level,
    temperature: data.temperature ?? 0,
    gas_ppm: data.gas_ppm ?? 0,
    current_draw: data.current_draw ?? 0,
    pump_active: Boolean(data.pump_active),
    valve_open: Boolean(data.valve_open),
    fan_active: Boolean(data.fan_active),
    status_class: (data.status_class ?? 2) as 0 | 1 | 2,
    health_label: data.health_label ?? null,
    recommendation: data.recommendation ?? null,
    data_valid: Boolean(data.data_valid),
    ambient_temp: data.ambient_temp ?? null,
    humidity: data.humidity ?? null,
    pressure_hpa: data.pressure_hpa ?? null,
    supply_voltage: data.supply_voltage ?? null,
    gas_sensor_mv: data.gas_sensor_mv ?? null,
    predictions: data.predictions ?? null,
    alerts: data.alerts ?? [],
  };
}

function fromSimulation(t: number): PlantSample {
  const tel = useWorkbenchStore.getState().telemetry;
  return {
    ...tel,
    t,
    health_label: null,
    recommendation: null,
    data_valid: true,
    ambient_temp: null,
    humidity: null,
    pressure_hpa: null,
    supply_voltage: null,
    gas_sensor_mv: null,
    predictions: null,
    alerts: [],
  };
}

/**
 * Live plant readings for the dashboard. The bridge is preferred because it carries the
 * real rig (via LabVIEW) and the ML predictions; without it the local 3D simulation is shown.
 */
export function usePlantLive(): PlantLiveState {
  const [state, setState] = useState<PlantLiveState>({
    source: 'offline', bridgeConnected: false, stale: false, lastUpdate: null, sample: null, history: [],
  });
  const lastBridgeStamp = useRef<string | null>(null);
  const lastBridgeChange = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const push = (patch: Omit<PlantLiveState, 'history'>, append: boolean) => {
      setState((prev) => ({
        ...patch,
        history: append && patch.sample ? [...prev.history, patch.sample].slice(-HISTORY_SIZE) : prev.history,
      }));
    };

    const poll = async () => {
      const now = Date.now();
      const simulating = useWorkbenchStore.getState().isSimulating;
      try {
        const res = await fetch(`${BACKEND_URL}/api/telemetry`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: BridgeState = await res.json();
        const sample = fromBridge(data, now);
        if (data.timestamp !== lastBridgeStamp.current) {
          lastBridgeStamp.current = data.timestamp ?? null;
          lastBridgeChange.current = now;
        }
        const stale = now - lastBridgeChange.current > STALE_MS;
        if (!cancelled) {
          push({ source: 'bridge', bridgeConnected: true, stale, lastUpdate: lastBridgeChange.current, sample },
               Boolean(sample) && !stale);
        }
      } catch {
        if (!cancelled) {
          const sample = simulating ? fromSimulation(now) : null;
          push({ source: simulating ? 'simulation' : 'offline', bridgeConnected: false, stale: false,
                 lastUpdate: sample ? now : null, sample }, Boolean(sample));
        }
      }
      if (!cancelled) timer = setTimeout(poll, POLL_MS);
    };

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return state;
}

export type ActuatorKey = 'pump_active' | 'valve_open' | 'fan_active';

export interface ControlResult {
  ok: boolean;
  message: string;
}

/** Manual actuator command through the bridge; it holds the command until LabVIEW applies it. */
export async function sendBridgeCommand(actuator: ActuatorKey, value: boolean): Promise<ControlResult> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [actuator]: value }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, message: data.recommendation ?? `HTTP ${res.status}` };
    if (data.status === 'interlocked') {
      return { ok: false, message: 'Blocked by a safety interlock; the bridge kept the safe state.' };
    }
    return { ok: true, message: 'Command sent. LabVIEW applies it on its next cycle.' };
  } catch {
    return { ok: false, message: 'Bridge unreachable; command not sent.' };
  }
}
