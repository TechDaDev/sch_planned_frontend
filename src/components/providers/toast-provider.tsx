'use client';

/**
 * Small accessible notification system.
 *
 * Used for create/update/activate/deactivate feedback. Deliberately local and
 * tiny: no UI package is added only to show messages.
 */

import * as React from 'react';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/utils/cn';

export type ToastTone = 'success' | 'danger' | 'info';

export interface ToastMessage {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastContextValue {
  notify: (toast: Omit<ToastMessage, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_CLASSES: Record<ToastTone, string> = {
  success: 'border-success/40 bg-success-surface',
  danger: 'border-danger/40 bg-danger-surface',
  info: 'border-line bg-surface',
};

const AUTO_DISMISS_MS = 6000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (toast: Omit<ToastMessage, 'id'>) => {
      const id = nextId.current;
      nextId.current += 1;
      setToasts((current) => [...current, { ...toast, id }]);
      window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === 'danger' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto w-full max-w-sm rounded-md border px-4 py-3 shadow-sm',
              TONE_CLASSES[toast.tone],
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">{toast.title}</p>
                {toast.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">{toast.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="rounded px-1 text-sm text-muted-foreground hover:text-foreground"
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (context === null) {
    throw new Error('useToast must be used inside a ToastProvider.');
  }
  return context;
}
