import { useState } from 'react';
import type { Movie } from '@ottlib/shared';
import { api } from '../hooks/apiClient';
import { useToast } from '../hooks/useToast';

const localHostnames = new Set(['localhost', '127.0.0.1', '[::1]']);
const iconButton = 'inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border-strong text-foreground transition-colors hover:bg-surface-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60';

function androidIntent(streamUrl: string, title: string): string { const url = new URL(streamUrl); return `intent://${url.host}${url.pathname}#Intent;scheme=${url.protocol.slice(0, -1)};type=video/*;action=android.intent.action.VIEW;S.browser_fallback_url=${encodeURIComponent(streamUrl)};S.title=${encodeURIComponent(title)};end`; }

export function PlayButton({ movie }: { movie: Movie }) {
  const [error, setError] = useState<string>(); const [working, setWorking] = useState(false); const { show } = useToast(); const isLocal = localHostnames.has(location.hostname); const streamUrl = `${location.origin}/api/stream/${movie.id}`;
  const play = async () => {
    setError(undefined); setWorking(true);
    if (isLocal) { try { await api<void>(`/api/movies/${movie.id}/play-local`, { method: 'POST' }); show('Opening your default player.', 'success'); } catch (reason) { const message = reason instanceof Error ? reason.message : 'Playback failed'; setError(message); show(message, 'error'); } finally { setWorking(false); } return; }
    show('Opening playback handoff…'); if (/Android/i.test(navigator.userAgent)) { location.href = androidIntent(streamUrl, movie.title); return; }
    location.href = `/api/stream/${movie.id}/playlist.m3u`;
  };
  const reveal = async () => { setError(undefined); setWorking(true); try { await api<void>(`/api/movies/${movie.id}/reveal`, { method: 'POST' }); show('Opened File Explorer with the movie selected.', 'success'); } catch (reason) { const message = reason instanceof Error ? reason.message : 'Unable to show folder'; setError(message); show(message, 'error'); } finally { setWorking(false); } };
  return <div className="contents">
    <button type="button" onClick={play} disabled={working} title="Play" aria-label="Play" className={`${iconButton} border-accent bg-accent text-accent-foreground hover:bg-accent-hover hover:text-accent-foreground`}>
      {working ? <svg aria-hidden="true" className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 12a8 8 0 1 1-2.34-5.66" /></svg> : <svg aria-hidden="true" className="h-5 w-5 translate-x-px" viewBox="0 0 24 24" fill="currentColor"><path d="m8 5 11 7-11 7V5Z" /></svg>}
      <span className="sr-only">Play</span>
    </button>
    {isLocal && <button type="button" onClick={reveal} disabled={working} title="Show in folder" aria-label="Show in folder" className={iconButton}>
      <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 6.75A1.75 1.75 0 0 1 4.75 5h4l1.7 2h8.8A1.75 1.75 0 0 1 21 8.75v8.5A1.75 1.75 0 0 1 19.25 19h-14A1.75 1.75 0 0 1 3.5 17.25V6.75Z" /><path d="M3.5 10h17" /></svg>
      <span className="sr-only">Show in folder</span>
    </button>}
    {error && <p className="basis-full text-sm text-error">{error}</p>}
  </div>;
}
