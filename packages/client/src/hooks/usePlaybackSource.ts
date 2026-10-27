import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlaybackSource } from '@ottlib/shared';
import { api } from './apiClient';
import { startSessionKeepAlive } from '../utils/sessionKeepAlive';
import { playbackQuery, type PlaybackCapabilities, type PlaybackSwitch } from '../utils/browserCaps';

export interface PlaybackSourceState {
  source: PlaybackSource | null;
  error: Error | null;
  loading: boolean;
  /** Asks the server again with another audio track, burned-in subtitle or start position (the old session is stopped). */
  switchTo: (change: PlaybackSwitch) => void;
  /** Applies a change the server confirmed (credits mark, auto-skip) without reopening the stream. */
  patchSource: (changes: Partial<PlaybackSource>) => void;
}

/** Stops a transcode session; keepalive so it still goes out while the page unloads. */
function stopSession(sessionUrl: string | undefined): void {
  if (sessionUrl) void api(sessionUrl, { method: 'DELETE', keepalive: true }).catch(() => undefined);
}

/** Keep-alive ping: no body (Fastify rejects an empty JSON body), same auth headers as the DELETE. */
function pingSession(url: string): Promise<unknown> {
  return api(url, { method: 'POST' });
}

/**
 * GET /api/movies/:id/playback with the browser's capabilities as the query. The server may open a transcode session
 * (`sessionUrl`); it is deleted on unmount, `pagehide` and when switching to another source.
 */
export function usePlaybackSource(movieId: number, capabilities: PlaybackCapabilities | null): PlaybackSourceState {
  const [change, setChange] = useState<PlaybackSwitch>({});
  const [state, setState] = useState<Omit<PlaybackSourceState, 'switchTo' | 'patchSource'>>({ source: null, error: null, loading: true });
  const session = useRef<string | undefined>(undefined);
  const stopKeepAlive = useRef<(() => void) | undefined>(undefined);
  const endKeepAlive = () => { stopKeepAlive.current?.(); stopKeepAlive.current = undefined; };

  useEffect(() => {
    if (!capabilities) return;
    let active = true;
    // Drop the old source: its session is DELETEd below, so the old <video> must stop (the page shows its spinner meanwhile).
    setState({ source: null, error: null, loading: true });
    api<PlaybackSource>(`/api/movies/${movieId}/playback?${playbackQuery(capabilities, change)}`)
      .then((source) => {
        // An answer that arrives after leaving (or after another switch) still opened a session: stop it right away.
        // Safe: the server issues a distinct sessionUrl per request, so this never stops the current session.
        if (!active) { stopSession(source.sessionUrl); return; }
        session.current = source.sessionUrl;
        if (source.sessionUrl) stopKeepAlive.current = startSessionKeepAlive(source.sessionUrl, { post: pingSession });
        setState({ source, error: null, loading: false });
      })
      .catch((error: unknown) => {
        if (active) setState({ source: null, error: error instanceof Error ? error : new Error('Playback failed'), loading: false });
      });
    return () => {
      active = false;
      endKeepAlive();
      stopSession(session.current);
      session.current = undefined;
    };
  }, [movieId, capabilities, change]);

  useEffect(() => {
    const onPageHide = () => { endKeepAlive(); stopSession(session.current); session.current = undefined; };
    // Back from the browser's page cache: the session was stopped on pagehide, so ask again.
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) setChange((previous) => ({ ...previous })); };
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    return () => { window.removeEventListener('pagehide', onPageHide); window.removeEventListener('pageshow', onPageShow); };
  }, []);

  const switchTo = useCallback((next: PlaybackSwitch) => setChange({ ...next }), []);
  const patchSource = useCallback((changes: Partial<PlaybackSource>) => {
    setState((previous) => (previous.source ? { ...previous, source: { ...previous.source, ...changes } } : previous));
  }, []);
  return { ...state, switchTo, patchSource };
}
