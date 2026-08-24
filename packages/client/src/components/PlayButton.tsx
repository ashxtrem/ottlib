import { useEffect, useState } from 'react';
import type { Movie } from '@ottlib/shared';
import { api } from '../hooks/apiClient';
import { useIsLocalClient } from '../hooks/useIsLocalClient';
import { useToast } from '../hooks/useToast';
import { focusRing, pressable } from './interactionStyles';

export type PlayButtonVariant = 'primary' | 'compact';

const compactButtonClassName = `inline-flex h-10 w-10 items-center justify-center rounded-lg border border-accent bg-accent text-accent-foreground transition-[background-color,color,transform] duration-fast ease-emphasis hover:bg-accent-hover hover:text-accent-foreground ${focusRing} ${pressable} disabled:cursor-not-allowed disabled:opacity-60`;
const primaryButtonClassName = `inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 font-semibold text-accent-foreground transition-[background-color,transform] duration-fast ease-emphasis hover:bg-accent-hover ${focusRing} ${pressable} disabled:cursor-not-allowed disabled:opacity-60`;

function androidIntent(streamUrl: string, title: string): string {
  const url = new URL(streamUrl);
  return `intent://${url.host}${url.pathname}#Intent;scheme=${url.protocol.slice(0, -1)};type=video/*;action=android.intent.action.VIEW;S.browser_fallback_url=${encodeURIComponent(streamUrl)};S.title=${encodeURIComponent(title)};end`;
}

export function supportsExternalPlaybackHandoff(userAgent: string): boolean {
  return /Android|OculusBrowser/i.test(userAgent);
}

export function PlayButton({ movie, variant = 'primary' }: { movie: Movie; variant?: PlayButtonVariant }) {
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<'idle' | 'working' | 'done'>('idle');
  const { show } = useToast();
  const isLocal = useIsLocalClient();
  const label = isLocal ? 'Play' : 'Play on this device';
  const streamUrl = `${location.origin}/api/stream/${movie.id}`;

  const play = async () => {
    setError(undefined);
    setStatus('working');

    if (isLocal) {
      let completed = false;
      try {
        await api<void>(`/api/movies/${movie.id}/play-local`, { method: 'POST' });
        show('Opening your default player.', 'success');
        completed = true;
        setStatus('done');
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : 'Playback failed';
        setError(message);
        show(message, 'error');
      } finally {
        if (!completed) setStatus('idle');
      }
      return;
    }

    show('Opening playback handoff…');
    if (supportsExternalPlaybackHandoff(navigator.userAgent)) {
      location.href = androidIntent(streamUrl, movie.title);
      return;
    }
    location.href = `/api/stream/${movie.id}/playlist.m3u`;
  };

  useEffect(() => {
    if (status !== 'done') return;
    const timer = window.setTimeout(() => setStatus('idle'), 1_200);
    return () => window.clearTimeout(timer);
  }, [status]);

  const isPrimary = variant === 'primary';
  return <>
    <button type="button" onClick={play} disabled={status !== 'idle'} title={label} aria-label={label} className={`${isPrimary ? primaryButtonClassName : compactButtonClassName} ${status === 'done' ? 'bg-success text-success-foreground hover:bg-success' : ''}`}>
      {status === 'working' ? <svg aria-hidden="true" className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 12a8 8 0 1 1-2.34-5.66" /></svg> : status === 'done' ? <svg aria-hidden="true" className="h-5 w-5 [stroke-dasharray:24] animate-draw-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path pathLength="24" d="m5 12 4 4L19 6" /></svg> : <svg aria-hidden="true" className="h-5 w-5 translate-x-px" viewBox="0 0 24 24" fill="currentColor"><path d="m8 5 11 7-11 7V5Z" /></svg>}
      {isPrimary ? <span>{status === 'done' ? 'Opening…' : label}</span> : <span className="sr-only">{label}</span>}
    </button>
    {error && <p className="text-sm text-error">{error}</p>}
  </>;
}
