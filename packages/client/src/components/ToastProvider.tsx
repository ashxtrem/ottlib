import { createContext, useCallback, useMemo, useState, type ReactNode } from 'react';
import { CloseIcon } from './icons';
import { generateId } from '../utils/id.js';

export type ToastTone = 'success' | 'error' | 'info';
export interface ToastAction { label: string; onClick: () => void }
export interface ToastOptions { action?: ToastAction }
export interface ToastApi { show(message: string, tone?: ToastTone, options?: ToastOptions): void }
export const ToastContext = createContext<ToastApi | undefined>(undefined);

interface Toast { id: string; message: string; tone: ToastTone; action?: ToastAction; count: number }
const toneClasses: Record<ToastTone, string> = { success: 'border-success-border bg-success-soft text-success-foreground', error: 'border-error-border bg-error-soft text-error-foreground', info: 'border-accent-soft-border bg-accent-soft text-accent-soft-foreground' };
export const toastTimeoutByTone: Record<ToastTone, number | undefined> = { success: 4_000, info: 6_000, error: undefined };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: string) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);
  const show = useCallback((message: string, tone: ToastTone = 'info', options: ToastOptions = {}) => {
    const id = generateId(); setToasts((current) => {
      const lastToast = current.at(-1);
      if (lastToast?.message === message) return [...current.slice(0, -1), { ...lastToast, count: lastToast.count + 1 }];
      return [...current, { id, message, tone, action: options.action, count: 1 }].slice(-4);
    });
    const timeout = toastTimeoutByTone[tone];
    if (timeout !== undefined) window.setTimeout(() => dismiss(id), timeout);
  }, [dismiss]);
  const value = useMemo(() => ({ show }), [show]);
  return <ToastContext.Provider value={value}>{children}<div className="pointer-events-none fixed left-4 top-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 sm:top-auto sm:bottom-24">{toasts.map((toast) => <div key={toast.id} role={toast.tone === 'error' ? 'alert' : 'status'} className={`pointer-events-auto rounded-lg border px-4 py-3 text-sm shadow-xl ${toneClasses[toast.tone]}`}><div className="flex items-start gap-3"><p className="min-w-0 flex-1">{toast.message}{toast.count > 1 && ` (${toast.count})`}</p><button type="button" onClick={() => dismiss(toast.id)} aria-label="Dismiss notification" title="Dismiss notification" className="-mr-1 -mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-black/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"><CloseIcon className="h-4 w-4" /><span className="sr-only">Dismiss notification</span></button></div>{toast.action && <button type="button" onClick={() => { toast.action?.onClick(); dismiss(toast.id); }} className="mt-3 rounded-md px-2 py-1 text-sm font-semibold underline underline-offset-2 hover:bg-black/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current">{toast.action.label}</button>}</div>)}</div></ToastContext.Provider>;
}
