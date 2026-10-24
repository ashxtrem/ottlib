import { useMemo } from 'react';
import { stepVolume } from '../utils/playerShortcuts';

/** Imperative commands on the `<video>` element; each is a no-op while there is no element. */
export function usePlayerCommands(video: HTMLVideoElement | null) {
  return useMemo(() => {
    const clampTime = (seconds: number) => {
      const end = video && Number.isFinite(video.duration) ? video.duration : Number.POSITIVE_INFINITY;
      return Math.min(Math.max(0, seconds), end);
    };
    return {
      togglePlay: () => { if (!video) return; if (video.paused || video.ended) void video.play().catch(() => undefined); else video.pause(); },
      seekBy: (seconds: number) => { if (video) video.currentTime = clampTime(video.currentTime + seconds); },
      seekTo: (ms: number) => { if (video) video.currentTime = clampTime(ms / 1000); },
      setVolume: (volume: number) => { if (!video) return; video.volume = volume; video.muted = volume === 0; },
      stepVolume: (delta: number) => { if (!video) return; video.volume = stepVolume(video.muted ? 0 : video.volume, delta); video.muted = video.volume === 0; },
      toggleMute: () => { if (!video) return; if (video.muted && video.volume === 0) video.volume = 0.5; video.muted = !video.muted; }
    };
  }, [video]);
}
