import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlaybackSource } from '@ottlib/shared';
import { api } from './apiClient';
import { playbackQuery, type PlaybackCapabilities, type PlaybackSwitch } from '../utils/browserCaps';

export interface PlaybackSourceState {
  source: PlaybackSource | null;
  error: Error | null;
  loading: boolean;
  /** Asks the server again with another audio track, burned-in subtitle or start position (the old session is stopped). */
  switchTo: (change: PlaybackSwitch) => void;
}

/** Stops a transcode session; keepalive so it still goes out while the page unloads. */
function stopSession(sessionUrl: string | undefined): void {
  if (sessionUrl) void api(sessionUrl, { method: 'DELETE', keepalive: true }).catch(() => undefined);
}

/**
 * GET /api/movies/:id/playback with the browser's capabilities as the query. The server may open a transcode session
 * (`sessionUrl`); it is deleted on unmount, `pagehide` and when switching to another source.
 */
export function usePlaybackSource(movieId: number, capabilities: PlaybackCapabilities | null): PlaybackSourceState {
  const [change, setChange] = useState<PlaybackSwitch>({});
  const [state, setState] = useState<Omit<PlaybackSourceState, 'switchTo'>>({ source: null, error: null, loading: true });
  const session = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!capabilities) return;
    let active = true;
    setState((previous) => ({ ...previous, error: null, loading: true }));
    api<PlaybackSource>(`/api/movies/${movieId}/playback?${playbackQuery(capabilities, change)}`)
      .then((source) => {
        // An answer that arrives after leaving (or after another switch) still opened a session: stop it right away.
        if (!active) { stopSession(source.sessionUrl); return; }
        session.current = source.sessionUrl;
        setState({ source, error: null, loading: false });
      })
      .catch((error: unknown) => {
        if (active) setState({ source: null, error: error instanceof Error ? error : new Error('Playback failed'), loading: false });
      });
    return () => {
      active = false;
      stopSession(session.current);
      session.current = undefined;
    };
  }, [movieId, capabilities, change]);

  useEffect(() => {
    const onPageHide = () => { stopSession(session.current); session.current = undefined; };
    // Back from the browser's page cache: the session was stopped on pagehide, so ask again.
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) setChange((previous) => ({ ...previous })); };
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    return () => { window.removeEventListener('pagehide', onPageHide); window.removeEventListener('pageshow', onPageShow); };
  }, []);

  const switchTo = useCallback((next: PlaybackSwitch) => setChange({ ...next }), []);
  return { ...state, switchTo };
}
