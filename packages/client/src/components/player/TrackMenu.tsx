import { useEffect, useRef, type ReactNode } from 'react';
import { focusRing } from '../interactionStyles';
import type { TrackMenuItem } from '../../utils/trackMenuItems';

interface TrackMenuProps<T extends TrackMenuItem> {
  /** "Audio" or "Subtitles": the button's name and the menu's heading. */
  label: string;
  icon: ReactNode;
  items: T[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: T) => void;
  /** Bigger touch target at phone width. */
  buttonClassName: string;
}

/** A player menu above its button (audio tracks, subtitles, More); closes on Escape, outside press or a pick. */
export function TrackMenu<T extends TrackMenuItem>({ label, icon, items, open, onOpenChange, onSelect, buttonClassName }: TrackMenuProps<T>) {
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePress = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node)) onOpenChange(false); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onOpenChange(false); };
    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('pointerdown', closeOnOutsidePress); document.removeEventListener('keydown', closeOnEscape); };
  }, [open, onOpenChange]);

  return <div ref={menu} className="relative">
    <button type="button" onClick={() => onOpenChange(!open)} aria-expanded={open} aria-haspopup="menu" aria-label={label} title={label} className={`${buttonClassName} ${focusRing}`}>{icon}</button>
    {open && <div role="menu" aria-label={label} className="absolute bottom-full right-0 mb-2 grid max-h-[60dvh] min-w-56 origin-bottom-right animate-pop-in gap-0.5 overflow-y-auto rounded-lg border border-white/10 bg-neutral-900/95 p-1 text-sm text-white shadow-xl">
      <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white/60">{label}</p>
      {items.map((item) => <button
        key={item.key}
        type="button"
        role={item.action ? 'menuitem' : 'menuitemradio'}
        aria-checked={item.action ? undefined : item.selected}
        disabled={item.disabled}
        onClick={() => { onSelect(item); onOpenChange(false); }}
        className={`flex min-h-11 items-center gap-2 rounded px-3 py-2 text-left hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 md:min-h-9 ${focusRing}`}
      >
        <span aria-hidden="true" className="w-4 shrink-0 text-accent">{item.selected ? '✓' : ''}</span>
        <span className="flex-1">{item.label}</span>
        {item.detail && <span className="text-xs text-white/60">{item.detail}</span>}
      </button>)}
    </div>}
  </div>;
}
