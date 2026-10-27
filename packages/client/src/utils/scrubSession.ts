import { SCRUB_INTERVAL_MS, createThrottle, frameTimeMs, frameUrl } from './scrubTiming';

/** The part of a `<video>` a live seek touches. */
export interface LiveSeekTarget {
  duration: number;
  currentTime: number;
  fastSeek?: (seconds: number) => void;
}

/** A seek that may land on a nearby keyframe (`fastSeek` where the browser has it) and stays inside the film. */
export function liveSeek(video: LiveSeekTarget, seconds: number): void {
  const end = Number.isFinite(video.duration) ? video.duration : Number.POSITIVE_INFINITY;
  const clamped = Math.min(Math.max(0, seconds), end);
  if (typeof video.fastSeek === 'function') video.fastSeek(clamped); else video.currentTime = clamped;
}

export interface ScrubSessionOptions {
  /** `direct`: the picture follows the drag. `hls`: a preview frame follows it and the stream is left alone until release. */
  kind: 'direct' | 'hls';
  durationMs: number | null;
  framePreviewUrl: string;
  /** Live seek for direct play. */
  seekLive: (seconds: number) => void;
  /** The frame at `url` as something an `<img>` can show, or null when there is none (a 204: a newer request replaced it). */
  fetchFrame: (url: string, signal: AbortSignal) => Promise<string | null>;
  /** Frees what `fetchFrame` made once the frame is no longer shown. */
  releaseFrame: (src: string) => void;
  /** The frame to show now; null clears it. The last frame stays up until the next one lands. */
  onFrame: (src: string | null) => void;
}

export interface ScrubSession {
  /** The drag is at `ms`. */
  scrub: (ms: number) => void;
  /** The drag is over (release, or the page goes away): drops pending work and the frame. */
  end: () => void;
}

/**
 * What the seek bar does while the thumb is dragged, for one playback source. At most one live seek or frame request
 * per 150 ms (the last position wins); frames come back out of order or as 204s and only newer ones are shown.
 */
export function createScrubSession(options: ScrubSessionOptions): ScrubSession {
  const { kind, durationMs, framePreviewUrl, seekLive, fetchFrame, releaseFrame, onFrame } = options;
  let controller = new AbortController();
  let requested = 0;
  let shown = 0;
  let lastTimeMs: number | null = null;
  let current: string | null = null;

  const show = (src: string | null) => {
    if (current !== null) releaseFrame(current);
    current = src;
    onFrame(src);
  };

  const requestFrame = (ms: number) => {
    const timeMs = frameTimeMs(ms, durationMs);
    if (timeMs === lastTimeMs) return;
    lastTimeMs = timeMs;
    requested += 1;
    const seq = requested;
    const { signal } = controller;
    fetchFrame(frameUrl(framePreviewUrl, timeMs), signal).then((src) => {
      if (src === null) return;
      if (signal.aborted || seq <= shown) { releaseFrame(src); return; }
      shown = seq;
      show(src);
    }, () => undefined);
  };

  const throttled = createThrottle<number>(kind === 'direct' ? (ms) => seekLive(ms / 1000) : requestFrame, SCRUB_INTERVAL_MS);

  return {
    scrub: throttled,
    end: () => {
      throttled.cancel();
      controller.abort();
      controller = new AbortController();
      requested = 0;
      shown = 0;
      lastTimeMs = null;
      if (current !== null) show(null);
    }
  };
}
