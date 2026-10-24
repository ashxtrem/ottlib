import { useEffect, useRef, useState } from 'react';
import type { Movie, PlaybackSource } from '@ottlib/shared';
import { api } from '../hooks/apiClient';
import { useIsLocalClient } from '../hooks/useIsLocalClient';
import { useToast } from '../hooks/useToast';
import { androidIntent, supportsExternalPlaybackHandoff } from './PlayButton';
import { focusRing, pressable } from './interactionStyles';

export type PlayMoreEntry = 'vlc' | 'app' | 'server';

const entryLabels: Record<PlayMoreEntry, string> = { vlc: 'Open in VLC', app: 'Open in app', server: 'Play on the server PC' };

/** VLC always; the app intent only where the browser can hand off; the server PC only on the host machine. */
export function playMoreEntries(isLocal: boolean, userAgent: string): PlayMoreEntry[] {
  const entries: PlayMoreEntry[] = ['vlc'];
  if (supportsExternalPlaybackHandoff(userAgent)) entries.push('app');
  if (isLocal) entries.push('server');
  return entries;
}

const itemClassName = `min-h-10 rounded px-3 py-2 text-left text-sm hover:bg-surface-raised ${focusRing}`;

export function PlayMoreMenuList({ entries, label, onSelect }: { entries: PlayMoreEntry[]; label: string; onSelect: (entry: PlayMoreEntry) => void }) {
  return <div role="menu" aria-label={label} className="absolute right-0 top-full z-20 mt-1 grid min-w-48 origin-top-right animate-pop-in gap-1 rounded-lg border border-border bg-surface p-1 shadow-xl">
    {entries.map((entry) => <button key={entry} type="button" role="menuitem" onClick={() => onSelect(entry)} className={itemClassName}>{entryLabels[entry]}</button>)}
  </div>;
}

export function PlayMoreMenu({ movie }: { movie: Movie }) {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const { show } = useToast();
  const isLocal = useIsLocalClient();
  const label = `More ways to play ${movie.title}`;

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePress = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node)) setOpen(false); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('pointerdown', closeOnOutsidePress); document.removeEventListener('keydown', closeOnEscape); };
  }, [open]);

  const fail = (reason: unknown) => show(reason instanceof Error ? reason.message : 'Playback failed', 'error');

  const handoff = async (entry: PlayMoreEntry) => {
    setOpen(false);
    try {
      if (entry === 'server') {
        await api<void>(`/api/movies/${movie.id}/play-local`, { method: 'POST' });
        show('Opening your default player.', 'success');
      } else if (entry === 'app') {
        show('Opening playback handoff…');
        // The stream URL carries the per-movie key an external player needs when a PIN is set.
        const source = await api<PlaybackSource>(`/api/movies/${movie.id}/playback`);
        location.href = androidIntent(new URL(source.streamUrl, location.origin).href, movie.title);
      } else {
        show('Opening playback handoff…');
        location.href = `/api/stream/${movie.id}/playlist.m3u`;
      }
    } catch (reason) {
      fail(reason);
    }
  };

  return <div ref={menu} className="relative shrink-0">
    <button type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-haspopup="menu" aria-label={label} title="More ways to play" className={`inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border-strong text-lg leading-none text-foreground transition-[background-color,transform] duration-fast ease-emphasis hover:bg-surface-raised ${focusRing} ${pressable}`}>⋯</button>
    {open && <PlayMoreMenuList entries={playMoreEntries(isLocal, navigator.userAgent)} label={label} onSelect={handoff} />}
  </div>;
}
