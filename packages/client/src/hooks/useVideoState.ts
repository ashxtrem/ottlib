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
  /** A picture is on screen: true from the first `loadeddata` or `playing`, false again on `emptied` (a new source). */
  firstFrame: boolean;
}

const idle: VideoState = { paused: true, ended: false, positionMs: 0, durationMs: Number.NaN, bufferedMs: 0, volume: 1, muted: false, firstFrame: false };

const events = ['play', 'pause', 'playing', 'loadeddata', 'timeupdate', 'durationchange', 'loadedmetadata', 'progress', 'volumechange', 'ended', 'seeking', 'seeked', 'emptied'];

function bufferedEnd(video: HTMLVideoElement): number {
  const { buffered, currentTime } = video;
  for (let index = 0; index < buffered.length; index += 1) {
    if (buffered.start(index) <= currentTime + 0.5 && buffered.end(index) >= currentTime) return buffered.end(index) * 1000;
  }
  return currentTime * 1000;
}

function read(video: HTMLVideoElement, fallbackDurationMs: number | null, endGuard: EndGuard, firstFrame: boolean): VideoState {
  const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration * 1000 : fallbackDurationMs ?? Number.NaN;
  return { paused: video.paused, ended: video.ended && isRealVideoEnd(video, endGuard), positionMs: video.currentTime * 1000, durationMs: duration, bufferedMs: bufferedEnd(video), volume: video.volume, muted: video.muted, firstFrame };
}

/**
 * Live play/pause, position, duration, buffered end and volume of a `<video>` element (for the custom controls).
 * `ended` is only true for a real end, so up next doesn't start on a false `ended` mid-file.
 */
export function useVideoState(video: HTMLVideoElement | null, fallbackDurationMs: number | null, endGuard: EndGuard): VideoState {
  const [state, setState] = useState<VideoState>(idle);
  useEffect(() => {
    if (!video) return;
    // HAVE_CURRENT_DATA: an element that already shows a picture when the hook (re)attaches.
    let firstFrame = video.readyState >= 2;
    const update = (event?: Event) => {
      // A loadeddata during the start seek (resume) is the frame at 0, not the one playback shows: wait for seeked/playing.
      if (event?.type === 'playing') firstFrame = true;
      else if ((event?.type === 'loadeddata' || event?.type === 'seeked') && !video.seeking && video.readyState >= 2) firstFrame = true;
      else if (event?.type === 'emptied') firstFrame = false;
      setState(read(video, fallbackDurationMs, endGuard, firstFrame));
    };
    update();
    events.forEach((name) => video.addEventListener(name, update));
    return () => events.forEach((name) => video.removeEventListener(name, update));
  }, [video, fallbackDurationMs, endGuard]);
  return state;
}
