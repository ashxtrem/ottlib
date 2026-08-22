import { useEffect, useRef, useState } from 'react';

interface ShelfCardMenuProps {
  title: string;
  busy?: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}

export function ShelfCardMenu({ title, busy, canMoveUp, canMoveDown, onMoveUp, onMoveDown, onRemove }: ShelfCardMenuProps) {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePress = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node)) setOpen(false); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('pointerdown', closeOnOutsidePress); document.removeEventListener('keydown', closeOnEscape); };
  }, [open]);

  const run = (action: () => void) => { action(); setOpen(false); };
  return <div ref={menu} className="absolute right-2 top-2 z-20">
    <button type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-haspopup="menu" aria-label={`Actions for ${title}`} className="flex h-9 w-9 items-center justify-center rounded-full bg-field/90 text-lg leading-none text-foreground shadow hover:bg-field focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">⋯</button>
    {open && <div role="menu" aria-label={`Actions for ${title}`} className="absolute right-0 top-full mt-1 grid min-w-40 gap-1 rounded-lg border border-border bg-surface p-1 shadow-xl"><button type="button" role="menuitem" onClick={() => run(onMoveUp)} disabled={busy || !canMoveUp} className="rounded px-2 py-1.5 text-left text-sm hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-50">Move up</button><button type="button" role="menuitem" onClick={() => run(onMoveDown)} disabled={busy || !canMoveDown} className="rounded px-2 py-1.5 text-left text-sm hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-50">Move down</button><button type="button" role="menuitem" onClick={() => run(onRemove)} disabled={busy} className="rounded px-2 py-1.5 text-left text-sm text-error hover:bg-error-soft/40 disabled:cursor-not-allowed disabled:opacity-50">Remove from shelf</button></div>}
  </div>;
}
