import { createContext, useCallback, useMemo, useState, type ReactNode } from 'react';
import { generateId } from '../utils/id.js';

export type ToastTone = 'success' | 'error' | 'info';
export interface ToastApi { show(message: string, tone?: ToastTone): void }
export const ToastContext = createContext<ToastApi | undefined>(undefined);

interface Toast { id: string; message: string; tone: ToastTone }
const toneClasses: Record<ToastTone, string> = { success: 'border-success-border bg-success-soft text-success-foreground', error: 'border-error-border bg-error-soft text-error-foreground', info: 'border-accent-soft-border bg-accent-soft text-accent-soft-foreground' };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: string) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);
  const show = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = generateId(); setToasts((current) => [...current, { id, message, tone }]); window.setTimeout(() => dismiss(id), 4_000);
  }, [dismiss]);
  const value = useMemo(() => ({ show }), [show]);
  return <ToastContext.Provider value={value}>{children}<div aria-live="polite" className="fixed bottom-4 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">{toasts.map((toast) => <button key={toast.id} onClick={() => dismiss(toast.id)} className={`rounded-lg border px-4 py-3 text-left text-sm shadow-xl ${toneClasses[toast.tone]}`}>{toast.message}</button>)}</div></ToastContext.Provider>;
}
