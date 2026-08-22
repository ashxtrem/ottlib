import { useState } from 'react';
import type { Movie } from '@ottlib/shared';
import { api } from '../hooks/apiClient';
import { useIsLocalClient } from '../hooks/useIsLocalClient';
import { useToast } from '../hooks/useToast';

export type PlayButtonVariant = 'primary' | 'compact';

const compactButtonClassName = 'inline-flex h-10 w-10 items-center justify-center rounded-lg border border-accent bg-accent text-accent-foreground transition-colors hover:bg-accent-hover hover:text-accent-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60';
const primaryButtonClassName = 'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 font-semibold text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60';

function androidIntent(streamUrl: string, title: string): string {
  const url = new URL(streamUrl);
  return `intent://${url.host}${url.pathname}#Intent;scheme=${url.protocol.slice(0, -1)};type=video/*;action=android.intent.action.VIEW;S.browser_fallback_url=${encodeURIComponent(streamUrl)};S.title=${encodeURIComponent(title)};end`;
}

export function PlayButton({ movie, variant = 'primary' }: { movie: Movie; variant?: PlayButtonVariant }) {
  const [error, setError] = useState<string>();
  const [working, setWorking] = useState(false);
  const { show } = useToast();
  const isLocal = useIsLocalClient();
  const label = isLocal ? 'Play' : 'Play on this device';
  const streamUrl = `${location.origin}/api/stream/${movie.id}`;

  const play = async () => {
    setError(undefined);
    setWorking(true);

    if (isLocal) {
      try {
        await api<void>(`/api/movies/${movie.id}/play-local`, { method: 'POST' });
        show('Opening your default player.', 'success');
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : 'Playback failed';
        setError(message);
        show(message, 'error');
      } finally {
        setWorking(false);
      }
      return;
    }

    show('Opening playback handoff…');
    if (/Android/i.test(navigator.userAgent)) {
      location.href = androidIntent(streamUrl, movie.title);
      return;
    }
    location.href = `/api/stream/${movie.id}/playlist.m3u`;
  };

  const isPrimary = variant === 'primary';
  return <>
    <button type="button" onClick={play} disabled={working} title={label} aria-label={label} className={isPrimary ? primaryButtonClassName : compactButtonClassName}>
      {working ? <svg aria-hidden="true" className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 12a8 8 0 1 1-2.34-5.66" /></svg> : <svg aria-hidden="true" className="h-5 w-5 translate-x-px" viewBox="0 0 24 24" fill="currentColor"><path d="m8 5 11 7-11 7V5Z" /></svg>}
      {isPrimary ? <span>{label}</span> : <span className="sr-only">{label}</span>}
    </button>
    {error && <p className="text-sm text-error">{error}</p>}
  </>;
}
