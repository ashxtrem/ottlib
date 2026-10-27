import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlaybackSource, SubtitleSource } from '@ottlib/shared';
import type { HlsEngine } from '../../utils/browserCaps';
import { CueOverlay, type CueClearance } from './CueOverlay';
import { useActiveCues } from '../../hooks/useActiveCues';
import { usePictureLayout } from '../../hooks/usePictureLayout';
import { isRealVideoEnd, type EndGuard } from '../../utils/playbackEnd';
import type { PictureModeId } from '../../utils/pictureModes';

interface VideoSurfaceProps {
  source: PlaybackSource;
  /** How an `hls` source is played here: the browser itself, hls.js (loaded on demand) or not at all. */
  hlsEngine: HlsEngine;
  /** Where playback starts (the resume position, or the position a track switch reopened at); applied once per source. */
  startMs?: number | null;
  /** The `<video>` element, for progress reporting and the custom controls. */
  onVideoElement?: (video: HTMLVideoElement | null) => void;
  onPlaybackError: (reason: 'media' | 'unsupported') => void;
  /** Text subtitles rendered as `<track>` (only those whose file is ready); the page picks which one shows. */
  textTracks: SubtitleSource[];
  /** Tells a false `ended` (mid-file on an hls source, e.g. iPad Safari after the server session is gone) from a real one. */
  endGuard: EndGuard;
  /** How the picture is fitted to the player box (Fit when absent). */
  pictureMode?: PictureModeId;
  /** Lifts the subtitle lines above the credits button and up next's card while they show. */
  cueClearance?: CueClearance;
}

type HlsInstance = { destroy(): void };

/** Recovery tries per fatal error kind before giving up; the count resets after a fragment loads. */
const HLS_RECOVERY_TRIES = 2;

/**
 * Attaches an HLS playlist with hls.js, which sits in its own chunk and only loads when this runs. Returns null when
 * hls.js isn't supported or the effect was cleaned up while the chunk loaded (then nothing touches the `<video>`).
 * A fatal network error (e.g. the server restarting ffmpeg after a seek) reloads and a media error recovers, a few times.
 */
async function attachHlsJs(video: HTMLVideoElement, url: string, startSec: number, onFatal: () => void, isCancelled: () => boolean): Promise<HlsInstance | null> {
  const { default: Hls } = await import('hls.js');
  if (isCancelled() || !Hls.isSupported()) return null;
  // The playlist covers the whole film, so loading starts straight at the start position (no detour via segment 0).
  const hls = new Hls({ enableWorker: true, startPosition: startSec > 0 ? startSec : -1 });
  let networkTries = 0;
  let mediaTries = 0;
  hls.on(Hls.Events.FRAG_LOADED, () => { networkTries = 0; mediaTries = 0; });
  hls.on(Hls.Events.ERROR, (_event, data) => {
    if (!data.fatal) return;
    if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkTries < HLS_RECOVERY_TRIES) { networkTries += 1; hls.startLoad(); return; }
    if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaTries < HLS_RECOVERY_TRIES) { mediaTries += 1; hls.recoverMediaError(); return; }
    onFatal();
  });
  hls.loadSource(url);
  hls.attachMedia(video);
  return hls;
}

export function VideoSurface({ source, hlsEngine, startMs, onVideoElement, onPlaybackError, textTracks, endGuard, pictureMode = 'Fit', cueClearance }: VideoSurfaceProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const setVideoRef = useCallback((element: HTMLVideoElement | null) => { videoRef.current = element; setVideoEl(element); }, []);
  const cueLines = useActiveCues(videoEl);
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const layout = usePictureLayout(box, videoRef, source.pictureArea, pictureMode);
  const errorRef = useRef(onPlaybackError); errorRef.current = onPlaybackError;
  const startRef = useRef(startMs); startRef.current = startMs;
  const guardRef = useRef(endGuard); guardRef.current = endGuard;

  useEffect(() => {
    onVideoElement?.(videoRef.current);
    return () => onVideoElement?.(null);
  }, [onVideoElement]);

  // A false end reopens the stream at the position (the page's media-failure path, once per run of playback).
  useEffect(() => {
    const video = videoRef.current;
    if (!video || source.kind !== 'hls') return;
    const onEnded = () => {
      const guard = guardRef.current;
      if (isRealVideoEnd(video, guard)) return;
      const positionMs = video.currentTime * 1000;
      // Recorded after the other `ended` listeners have run, so they judge this event against the previous false end only.
      setTimeout(() => { guard.lastFalseEnd.current = positionMs; }, 0);
      errorRef.current('media');
    };
    video.addEventListener('ended', onEnded);
    return () => video.removeEventListener('ended', onEnded);
  }, [source.kind, source.streamUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    let hls: HlsInstance | null = null;
    const start = (startRef.current ?? 0) / 1000;
    const seekToStart = () => { if (start > 0 && video.currentTime < 1) video.currentTime = start; };
    video.addEventListener('loadedmetadata', seekToStart, { once: true });
    if (source.kind === 'direct' || hlsEngine === 'native') {
      video.src = source.streamUrl;
    } else if (hlsEngine === 'hlsjs') {
      attachHlsJs(video, source.streamUrl, start, () => errorRef.current('media'), () => cancelled)
        .then((instance) => {
          if (cancelled) instance?.destroy(); else if (instance) hls = instance; else errorRef.current('unsupported');
        })
        .catch(() => { if (!cancelled) errorRef.current('unsupported'); });
    } else {
      errorRef.current('unsupported');
    }
    return () => {
      cancelled = true;
      video.removeEventListener('loadedmetadata', seekToStart);
      hls?.destroy();
      video.removeAttribute('src');
      video.load();
    };
  }, [source.kind, source.streamUrl, hlsEngine]);

  // The video is placed by hand in an overflow-hidden box (see pictureGeometry); until its size is known it just fits.
  return <div ref={setBox} className="absolute inset-0 overflow-hidden bg-black"><video
    ref={setVideoRef}
    playsInline
    autoPlay
    onError={(event) => {
      // With hls.js the element's error is the same MSE failure hls.js reports: its fatal callback (after the retries) is the reporter.
      if (source.kind !== 'direct' && hlsEngine === 'hlsjs') return;
      if (event.currentTarget.error && event.currentTarget.getAttribute('src')) onPlaybackError('media');
    }}
    className={layout ? 'absolute max-w-none bg-black object-fill' : 'h-full w-full bg-black object-contain'}
    style={layout ? { left: layout.left, top: layout.top, width: layout.width, height: layout.height } : undefined}
  >
    {textTracks.map((subtitle, index) => <track
      key={subtitle.url}
      kind="subtitles"
      src={subtitle.url}
      srcLang={subtitle.language ?? undefined}
      label={subtitle.title ?? subtitle.language ?? `Subtitles ${index + 1}`}
    />)}
  </video><CueOverlay lines={cueLines} clearance={cueClearance} /></div>;
}
