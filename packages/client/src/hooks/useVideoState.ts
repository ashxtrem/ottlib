import { useEffect, useState } from 'react';
import { isRealVideoEnd, type EndGuard } from '../utils/playbackEnd';

export interface VideoState {
  paused: boolean;
  ended: boolean;
  positionMs: number;
  /** NaN while unknown. */
  durationMs: number;
  /** End of the buffered range around the playhead. */
  bufferedMs: number;
  volume: number;
  muted: boolean;
}

const idle: VideoState = { paused: true, ended: false, positionMs: 0, durationMs: Number.NaN, bufferedMs: 0, volume: 1, muted: false };

const events = ['play', 'pause', 'playing', 'timeupdate', 'durationchange', 'loadedmetadata', 'progress', 'volumechange', 'ended', 'seeking', 'seeked', 'emptied'];

function bufferedEnd(video: HTMLVideoElement): number {
  const { buffered, currentTime } = video;
  for (let index = 0; index < buffered.length; index += 1) {
    if (buffered.start(index) <= currentTime + 0.5 && buffered.end(index) >= currentTime) return buffered.end(index) * 1000;
  }
  return currentTime * 1000;
}

function read(video: HTMLVideoElement, fallbackDurationMs: number | null, endGuard: EndGuard): VideoState {
  const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration * 1000 : fallbackDurationMs ?? Number.NaN;
  return { paused: video.paused, ended: video.ended && isRealVideoEnd(video, endGuard), positionMs: video.currentTime * 1000, durationMs: duration, bufferedMs: bufferedEnd(video), volume: video.volume, muted: video.muted };
}

/**
 * Live play/pause, position, duration, buffered end and volume of a `<video>` element (for the custom controls).
 * `ended` is only true for a real end, so up next doesn't start on a false `ended` mid-file.
 */
export function useVideoState(video: HTMLVideoElement | null, fallbackDurationMs: number | null, endGuard: EndGuard): VideoState {
  const [state, setState] = useState<VideoState>(idle);
  useEffect(() => {
    if (!video) return;
    const update = () => setState(read(video, fallbackDurationMs, endGuard));
    update();
    events.forEach((name) => video.addEventListener(name, update));
    return () => events.forEach((name) => video.removeEventListener(name, update));
  }, [video, fallbackDurationMs, endGuard]);
  return state;
}
