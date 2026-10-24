import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Movie } from '@ottlib/shared';
import { api } from './apiClient';
import { upNextPhase, type UpNextPhase } from '../utils/upNextTiming';

interface UpNextOptions {
  movieId: number;
  shelfId?: number;
  positionMs: number;
  durationMs: number;
  ended: boolean;
}

export function watchPath(movieId: number, shelfId?: number): string {
  return `/watch/${movieId}${shelfId === undefined ? '' : `?shelf=${shelfId}`}`;
}

/**
 * The next episode (or next title of the shelf) from GET /api/movies/:id/next: shown when 20 s remain, then a 10 s
 * countdown after the end that opens it. Cancel keeps the viewer on the finished one.
 */
export function useUpNext({ movieId, shelfId, positionMs, durationMs, ended }: UpNextOptions) {
  const navigate = useNavigate();
  const [next, setNext] = useState<Movie | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [endedAtMs, setEndedAtMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    const query = shelfId === undefined ? '' : `?shelfId=${shelfId}`;
    api<Movie | null>(`/api/movies/${movieId}/next${query}`)
      .then((movie) => { if (active) setNext(movie ?? null); })
      .catch(() => { if (active) setNext(null); });
    return () => { active = false; };
  }, [movieId, shelfId]);

  // Seeking back after the end clears `ended`, which stops the countdown.
  useEffect(() => {
    const now = Date.now();
    setEndedAtMs(ended ? now : null);
    setNowMs(now);
  }, [ended]);

  useEffect(() => {
    if (endedAtMs === null || cancelled || !next) return;
    const timer = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(timer);
  }, [endedAtMs, cancelled, next]);

  const phase: UpNextPhase = upNextPhase({ hasNext: next !== null, cancelled, positionMs, durationMs, endedAtMs, nowMs });
  const playNow = useCallback(() => { if (next) navigate(watchPath(next.id, shelfId), { replace: true }); }, [next, shelfId, navigate]);
  const cancel = useCallback(() => setCancelled(true), []);

  useEffect(() => { if (phase.kind === 'advance') playNow(); }, [phase.kind, playNow]);

  return { next, phase, playNow, cancel };
}
