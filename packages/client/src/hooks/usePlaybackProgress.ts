import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { api } from './apiClient';
import { isRealVideoEnd, type EndGuard } from '../utils/playbackEnd';
import { progressAction, progressBody, type ProgressTrigger } from '../utils/progressSchedule';

interface ProgressOptions {
  movieId: number;
  /** Used while the element doesn't know its duration yet (or reports Infinity for a growing HLS playlist). */
  fallbackDurationMs: number | null;
  shelfId?: number;
  /** An `ended` that isn't a real end (mid-file on an HLS source) doesn't post complete. */
  endGuard: EndGuard;
  /** True while the seek bar is dragged: the live seeks don't report; the release seek does, once. */
  scrubbing?: RefObject<boolean>;
}

/**
 * Reports playback progress for the given `<video>`: PUT every 10 s while playing and on pause, seek end, `pagehide` and
 * leaving the page; POST complete on `ended`. Requests go through `api` with `keepalive`, so the profile headers go along
 * and the last one survives the page closing. `complete()` posts complete now (skipping the credits) and stops the
 * later PUTs, so the leave on the way out doesn't save a resume position in the credits.
 */
export function usePlaybackProgress(video: HTMLVideoElement | null, { movieId, fallbackDurationMs, shelfId, endGuard, scrubbing }: ProgressOptions): { complete: () => Promise<void> } {
  const guardRef = useRef(endGuard); guardRef.current = endGuard;
  const completed = useRef(false);
  // Keeps the last known duration of this movie: a track switch renders the page without a source (null) while the
  // emptied element reports NaN, and the switch-time leave still needs a duration.
  const fallback = useRef<{ movieId: number; ms: number | null }>({ movieId, ms: fallbackDurationMs });
  if (fallback.current.movieId !== movieId) fallback.current = { movieId, ms: fallbackDurationMs };
  else if (fallbackDurationMs !== null && Number.isFinite(fallbackDurationMs) && fallbackDurationMs > 0) fallback.current.ms = fallbackDurationMs;
  useEffect(() => {
    if (!video) return;
    let lastSentAt: number | null = null;
    // The last position seen on timeupdate/seeked: VideoSurface may unmount first and reset currentTime to 0.
    const lastPosition = { ms: video.currentTime * 1000 };
    const durationMs = () => (Number.isFinite(video.duration) && video.duration > 0 ? video.duration * 1000 : fallback.current.ms ?? Number.NaN);
    const shelfQuery = shelfId === undefined ? '' : `?shelfId=${shelfId}`;
    const send = (trigger: ProgressTrigger, positionMs = video.currentTime * 1000) => {
      if (completed.current) return;
      const duration = durationMs(); const now = Date.now();
      const action = progressAction(trigger, { now, lastSentAt, positionMs, durationMs: duration, ended: video.ended && isRealVideoEnd(video, guardRef.current) });
      if (action === 'put') {
        lastSentAt = now;
        void api(`/api/movies/${movieId}/progress`, { method: 'PUT', body: JSON.stringify(progressBody(positionMs, duration, shelfId)), keepalive: true }).catch(() => undefined);
      } else if (action === 'complete') {
        void api(`/api/movies/${movieId}/complete${shelfQuery}`, { method: 'POST', keepalive: true }).catch(() => undefined);
      }
    };
    // An emptied element (after `load()` without a src) reports 0: keep the last real position.
    const remember = () => { if (video.readyState > 0) lastPosition.ms = video.currentTime * 1000; };
    const onTick = () => { remember(); if (!video.paused) send('tick'); };
    const onPause = () => send('pause');
    const onSeeked = () => { remember(); if (!scrubbing?.current) send('seeked'); };
    const onEnded = () => { if (isRealVideoEnd(video, guardRef.current)) send('ended'); };
    const onLeave = () => send('leave');
    video.addEventListener('timeupdate', onTick);
    video.addEventListener('pause', onPause);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('ended', onEnded);
    window.addEventListener('pagehide', onLeave);
    return () => {
      video.removeEventListener('timeupdate', onTick);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('ended', onEnded);
      window.removeEventListener('pagehide', onLeave);
      // Leaving the watch page inside the app is a leave too (only when something has played).
      remember();
      if (lastPosition.ms > 0) send('leave', lastPosition.ms);
    };
  }, [video, movieId, shelfId, scrubbing]);

  const complete = useCallback(async () => {
    completed.current = true;
    const shelfQuery = shelfId === undefined ? '' : `?shelfId=${shelfId}`;
    await api(`/api/movies/${movieId}/complete${shelfQuery}`, { method: 'POST', keepalive: true }).catch(() => undefined);
  }, [movieId, shelfId]);
  return { complete };
}
