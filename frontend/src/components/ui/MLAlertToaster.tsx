import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';
import type { MLAlert } from '../../types/predictions';

const MAX_TOASTS = 3;
const TOAST_MS = { critical: 15000, warning: 8000, info: 5000 } as const;
const STYLES = {
  critical: 'bg-red-600 text-white border-red-700',
  warning: 'bg-amber-500 text-white border-amber-600',
  info: 'bg-sky-600 text-white border-sky-700',
} as const;

/** Pops a toast for every alert the bridge raises, whichever panel is open. */
export const MLAlertToaster: React.FC<{ alerts: MLAlert[]; onOpenPanel?: () => void }> = ({ alerts, onOpenPanel }) => {
  const seen = useRef(new Set<number>());
  // Timers outlive individual polls; only unmount cancels them.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [toasts, setToasts] = useState<MLAlert[]>([]);

  useEffect(() => {
    const fresh = alerts.filter((a) => !seen.current.has(a.alert_id));
    if (fresh.length === 0) return;
    fresh.forEach((a) => seen.current.add(a.alert_id));
    setToasts((prev) => [...fresh, ...prev].slice(0, MAX_TOASTS));
    fresh.forEach((a) =>
      timers.current.push(
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.alert_id !== a.alert_id)), TOAST_MS[a.severity]),
      ),
    );
  }, [alerts]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-[60px] sm:top-[104px] left-1/2 -translate-x-1/2 z-40 w-[calc(100vw-2rem)] sm:w-[28rem] space-y-2" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.alert_id}
          className={`flex items-start space-x-2 px-3 py-2 rounded-xl border shadow-lg text-xs ${STYLES[toast.severity]}`}
        >
          {toast.severity === 'info' ? <Info className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
          <button className="flex-1 text-left" onClick={onOpenPanel} title="Open Predictive Analytics">
            <div className="font-bold uppercase text-[10px] tracking-wide">
              {toast.severity} · {toast.kind}
            </div>
            <div>{toast.message}</div>
          </button>
          <button
            onClick={() => setToasts((prev) => prev.filter((t) => t.alert_id !== toast.alert_id))}
            className="p-0.5 rounded hover:bg-white/20"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
