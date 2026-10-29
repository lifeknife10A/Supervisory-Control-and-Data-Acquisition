import { useEffect, useState } from 'react';
import { BACKEND_URL } from '../constants/backend';
import type { AlertEvent, MLAlert, ModelStatus, Predictions, PredictionsResponse } from '../types/predictions';

const POLL_MS = 1500;
const OFFLINE_POLL_MS = 5000;
const HISTORY_EVERY = 3; // fetch the event log on every 3rd poll

export interface BackendPredictionsState {
  connected: boolean;
  predictions: Predictions | null;
  alerts: MLAlert[];
  events: AlertEvent[];
  models: ModelStatus | null;
  lastUpdated: string | null;
}

const INITIAL: BackendPredictionsState = {
  connected: false,
  predictions: null,
  alerts: [],
  events: [],
  models: null,
  lastUpdated: null,
};

/** Polls the bridge for ML predictions and alerts; backs off while it is unreachable. */
export function useBackendPredictions(withHistory: boolean): BackendPredictionsState {
  const [state, setState] = useState<BackendPredictionsState>(INITIAL);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let polls = 0;

    const poll = async () => {
      let delay = POLL_MS;
      try {
        const res = await fetch(`${BACKEND_URL}/api/predictions`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: PredictionsResponse = await res.json();
        let events: AlertEvent[] | undefined;
        if (withHistory && polls % HISTORY_EVERY === 0) {
          const history = await fetch(`${BACKEND_URL}/api/alerts?limit=25`);
          if (history.ok) events = (await history.json()).events;
        }
        polls += 1;
        if (!cancelled) {
          setState((prev) => ({
            connected: true,
            predictions: data.predictions,
            alerts: data.alerts,
            events: events ?? prev.events,
            models: data.models,
            lastUpdated: data.timestamp,
          }));
        }
      } catch {
        delay = OFFLINE_POLL_MS;
        if (!cancelled) setState((prev) => ({ ...prev, connected: false }));
      }
      if (!cancelled) timer = setTimeout(poll, delay);
    };

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [withHistory]);

  return state;
}
