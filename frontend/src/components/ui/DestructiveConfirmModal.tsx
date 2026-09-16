import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useWorkbenchStore } from '../../store/workbenchStore';

export const DestructiveConfirmModal: React.FC = () => {
  const confirmation = useWorkbenchStore((s) => s.destructiveConfirmation);
  const setDestructiveConfirmation = useWorkbenchStore((s) => s.setDestructiveConfirmation);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && confirmation) {
        setDestructiveConfirmation(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmation, setDestructiveConfirmation]);

  if (!confirmation) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in-50"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/30">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 id="confirm-modal-title" className="text-sm font-bold text-white">
                {confirmation.title}
              </h3>
              <p className="text-xs text-slate-400">Action cannot be undone without history</p>
            </div>
          </div>
          <button
            onClick={() => setDestructiveConfirmation(null)}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition"
            aria-label="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p id="confirm-modal-desc" className="text-xs text-slate-300 leading-relaxed">
          {confirmation.message}
        </p>

        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
          <button
            onClick={() => setDestructiveConfirmation(null)}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              confirmation.onConfirm();
              setDestructiveConfirmation(null);
            }}
            className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition shadow"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};
