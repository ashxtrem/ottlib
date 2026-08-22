import { useEffect, useId, useRef, type ReactNode } from 'react';
import { CloseIcon } from './icons';

let scrollLockCount = 0;
let bodyOverflow = '';
let documentOverflow = '';

function lockScroll() {
  if (scrollLockCount++ > 0) return;
  bodyOverflow = document.body.style.overflow;
  documentOverflow = document.documentElement.style.overflow;
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
}

function unlockScroll() {
  if (--scrollLockCount > 0) return;
  scrollLockCount = 0;
  document.body.style.overflow = bodyOverflow;
  document.documentElement.style.overflow = documentOverflow;
}

interface ModalProps {
  open: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClassName?: string;
  panelClassName?: string;
  onClose: () => void;
}

export function Modal({ open, title, subtitle, children, footer, maxWidthClassName = 'max-w-lg', panelClassName = '', onClose }: ModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const lastActiveElement = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open || !dialog.current) return;
    const element = dialog.current;
    lastActiveElement.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element.showModal();
    lockScroll();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onCloseRef.current();
    };
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      unlockScroll();
      if (element.open) element.close();
      if (lastActiveElement.current?.isConnected) lastActiveElement.current.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  return <dialog ref={dialog} onCancel={(event) => event.preventDefault()} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} aria-labelledby={titleId} className="fixed inset-0 z-40 m-0 flex h-dvh w-screen max-h-none max-w-none items-end justify-center overflow-hidden border-0 bg-transparent p-4 backdrop:bg-overlay/80 sm:items-center">
    <div className={`flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl ${maxWidthClassName} ${panelClassName}`}>
      <div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 id={titleId} className="text-lg font-semibold">{title}</h2>{subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}</div><button type="button" onClick={onClose} className="rounded p-1 text-muted hover:text-foreground" aria-label="Close"><CloseIcon className="h-5 w-5" /></button></div>
      {children}
      {footer && <div className="flex justify-end gap-3 border-t border-border p-4">{footer}</div>}
    </div>
  </dialog>;
}
