import { useEffect, useRef } from 'react';
import { api } from './apiClient';
import { progressAction, progressBody, type ProgressTrigger } from '../utils/progressSchedule';

interface ProgressOptions {
  movieId: number;
  /** Used while the element doesn't know its duration yet (or reports Infinity for a growing HLS playlist). */
  fallbackDurationMs: number | null;
  shelfId?: number;
}

/**
 * Reports playback progress for the given `<video>`: PUT every 10 s while playing and on pause, seek end, `pagehide` and
 * leaving the page; POST complete on `ended`. Requests go through `api` with `keepalive`, so the profile headers go along
 * and the last one survives the page closing.
 */
export function usePlaybackProgress(video: HTMLVideoElement | null, { movieId, fallbackDurationMs, shelfId }: ProgressOptions): void {
  const fallback = useRef(fallbackDurationMs); fallback.current = fallbackDurationMs;
  useEffect(() => {
    if (!video) return;
    let lastSentAt: number | null = null;
    const durationMs = () => (Number.isFinite(video.duration) && video.duration > 0 ? video.duration * 1000 : fallback.current ?? Number.NaN);
    const shelfQuery = shelfId === undefined ? '' : `?shelfId=${shelfId}`;
    const send = (trigger: ProgressTrigger) => {
      const positionMs = video.currentTime * 1000; const duration = durationMs(); const now = Date.now();
      const action = progressAction(trigger, { now, lastSentAt, positionMs, durationMs: duration, ended: video.ended });
      if (action === 'put') {
        lastSentAt = now;
        void api(`/api/movies/${movieId}/progress`, { method: 'PUT', body: JSON.stringify(progressBody(positionMs, duration, shelfId)), keepalive: true }).catch(() => undefined);
      } else if (action === 'complete') {
        void api(`/api/movies/${movieId}/complete${shelfQuery}`, { method: 'POST', keepalive: true }).catch(() => undefined);
      }
    };
    const onTick = () => { if (!video.paused) send('tick'); };
    const onPause = () => send('pause');
    const onSeeked = () => send('seeked');
    const onEnded = () => send('ended');
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
      if (video.currentTime > 0) onLeave();
    };
  }, [video, movieId, shelfId]);
}
