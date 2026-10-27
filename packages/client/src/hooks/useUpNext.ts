import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Movie } from '@ottlib/shared';
import { api } from './apiClient';
import { reachedStartAt, upNextPhase, type UpNextPhase } from '../utils/upNextTiming';

interface UpNextOptions {
  movieId: number;
  shelfId?: number;
  positionMs: number;
  durationMs: number;
  ended: boolean;
  /** Position where the countdown starts early (the credits, auto-skip on); null keeps the 20 s lead. */
  startAtMs?: number | null;
  /** Runs before opening the next title when the countdown started at `startAtMs` (posts complete). */
  beforeEarlyNext?: () => Promise<void>;
}

export function watchPath(movieId: number, shelfId?: number): string {
  return `/watch/${movieId}${shelfId === undefined ? '' : `?shelf=${shelfId}`}`;
}

/**
 * The next episode (or next title of the shelf) from GET /api/movies/:id/next: shown when 20 s remain, then a 10 s
 * countdown after the end that opens it. With `startAtMs` the countdown starts there instead. Cancel keeps the viewer
 * on the finished one.
 */
export function useUpNext({ movieId, shelfId, positionMs, durationMs, ended, startAtMs = null, beforeEarlyNext }: UpNextOptions) {
  const navigate = useNavigate();
  const [next, setNext] = useState<Movie | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [endedAtMs, setEndedAtMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const advancing = useRef(false);

  useEffect(() => {
    let active = true;
    const query = shelfId === undefined ? '' : `?shelfId=${shelfId}`;
    api<Movie | null>(`/api/movies/${movieId}/next${query}`)
      .then((movie) => { if (active) setNext(movie ?? null); })
      .catch(() => { if (active) setNext(null); });
    return () => { active = false; };
  }, [movieId, shelfId]);

  // Seeking back after the end (or before the early start) clears the trigger, which stops the countdown.
  const early = !ended && reachedStartAt(positionMs, startAtMs);
  const triggered = ended || early;
  useEffect(() => {
    const now = Date.now();
    setEndedAtMs(triggered ? now : null);
    setNowMs(now);
  }, [triggered]);

  useEffect(() => {
    if (endedAtMs === null || cancelled || !next) return;
    const timer = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(timer);
  }, [endedAtMs, cancelled, next]);

  const phase: UpNextPhase = upNextPhase({ hasNext: next !== null, cancelled, positionMs, durationMs, endedAtMs, nowMs, startAtMs });
  const playNow = useCallback(() => {
    if (!next || advancing.current) return;
    advancing.current = true;
    const open = () => navigate(watchPath(next.id, shelfId), { replace: true });
    if (early && beforeEarlyNext) void beforeEarlyNext().finally(open); else open();
  }, [next, shelfId, navigate, early, beforeEarlyNext]);
  const cancel = useCallback(() => setCancelled(true), []);

  useEffect(() => { if (phase.kind === 'advance') playNow(); }, [phase.kind, playNow]);

  return { next, phase, playNow, cancel, cancelled };
}
