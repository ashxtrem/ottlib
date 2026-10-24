import { useEffect, useRef } from 'react';
import type { PlaybackSource, SubtitleSource } from '@ottlib/shared';
import type { HlsEngine } from '../../utils/browserCaps';

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

export function VideoSurface({ source, hlsEngine, startMs, onVideoElement, onPlaybackError, textTracks }: VideoSurfaceProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const errorRef = useRef(onPlaybackError); errorRef.current = onPlaybackError;
  const startRef = useRef(startMs); startRef.current = startMs;

  useEffect(() => {
    onVideoElement?.(videoRef.current);
    return () => onVideoElement?.(null);
  }, [onVideoElement]);

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

  return <video
    ref={videoRef}
    playsInline
    autoPlay
    onError={(event) => {
      // With hls.js the element's error is the same MSE failure hls.js reports: its fatal callback (after the retries) is the reporter.
      if (source.kind !== 'direct' && hlsEngine === 'hlsjs') return;
      if (event.currentTarget.error && event.currentTarget.getAttribute('src')) onPlaybackError('media');
    }}
    className="h-full w-full bg-black object-contain"
  >
    {textTracks.map((subtitle, index) => <track
      key={subtitle.url}
      kind="subtitles"
      src={subtitle.url}
      srcLang={subtitle.language ?? undefined}
      label={subtitle.title ?? subtitle.language ?? `Subtitles ${index + 1}`}
    />)}
  </video>;
}
