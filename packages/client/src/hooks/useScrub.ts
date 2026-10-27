import { useEffect, useMemo, useState } from 'react';
import type { PlaybackSource } from '@ottlib/shared';
import { createScrubSession, liveSeek, type ScrubSession } from '../utils/scrubSession';

export interface ScrubControls {
  /** The seek bar's thumb is at `ms` (while dragging). */
  onScrub: (ms: number) => void;
  /** The drag is over; the release itself seeks exactly. */
  onScrubEnd: () => void;
  /** True for server HLS, where the preview is a frame; false when the picture itself follows the drag. */
  showsFrame: boolean;
  /** The preview frame (an object URL), or null until the first one lands. */
  frameSrc: string | null;
}

const noSession: ScrubSession = { scrub: () => undefined, end: () => undefined };

/** A frame as an object URL, or null for a 204 (a newer request from this client replaced it) or any failure. */
async function fetchFrame(url: string, signal: AbortSignal): Promise<string | null> {
  const response = await fetch(url, { signal });
  if (response.status !== 200) return null;
  return URL.createObjectURL(await response.blob());
}

/**
 * Scrubbing the seek bar. Direct play moves the real video while you drag (`fastSeek` where there is one, at most one
 * seek per 150 ms). A server HLS stream restarts ffmpeg on every seek, so it only shows a preview frame from the
 * frame route and leaves the stream alone until release.
 */
export function useScrub(video: HTMLVideoElement | null, source: PlaybackSource | null): ScrubControls {
  const [frameSrc, setFrameSrc] = useState<string | null>(null);
  const kind = source?.kind ?? null;
  const framePreviewUrl = source?.framePreviewUrl ?? null;
  const durationMs = source?.durationMs ?? null;
  const session = useMemo<ScrubSession>(() => {
    if (!kind || framePreviewUrl === null) return noSession;
    return createScrubSession({
      kind, durationMs, framePreviewUrl,
      seekLive: (seconds) => { if (video) liveSeek(video, seconds); },
      fetchFrame,
      releaseFrame: (src) => URL.revokeObjectURL(src),
      onFrame: setFrameSrc
    });
  }, [kind, framePreviewUrl, durationMs, video]);
  useEffect(() => () => session.end(), [session]);
  return useMemo(() => ({ onScrub: session.scrub, onScrubEnd: session.end, showsFrame: kind === 'hls', frameSrc }), [session, kind, frameSrc]);
}
