import { useEffect, useRef } from 'react';
import type { PlaybackSource } from '@ottlib/shared';
import type { HlsEngine } from '../../utils/browserCaps';

interface VideoSurfaceProps {
  source: PlaybackSource;
  /** How an `hls` source is played here: the browser itself, hls.js (loaded on demand) or not at all. */
  hlsEngine: HlsEngine;
  /** Where playback starts (the resume position); applied once per source. */
  startMs?: number | null;
  /** The `<video>` element, for progress reporting and (later) custom controls. */
  onVideoElement?: (video: HTMLVideoElement | null) => void;
  onPlaybackError: (reason: 'media' | 'unsupported') => void;
  /** Native browser controls; a placeholder until the custom controls take over. */
  nativeControls?: boolean;
}

type HlsInstance = { destroy(): void };

/** Attaches an HLS playlist with hls.js, which sits in its own chunk and only loads when this runs. */
async function attachHlsJs(video: HTMLVideoElement, url: string, onFatal: () => void): Promise<HlsInstance | null> {
  const { default: Hls } = await import('hls.js');
  if (!Hls.isSupported()) return null;
  const hls = new Hls({ enableWorker: true });
  hls.on(Hls.Events.ERROR, (_event, data) => { if (data.fatal) onFatal(); });
  hls.loadSource(url);
  hls.attachMedia(video);
  return hls;
}

export function VideoSurface({ source, hlsEngine, startMs, onVideoElement, onPlaybackError, nativeControls = true }: VideoSurfaceProps) {
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
      attachHlsJs(video, source.streamUrl, () => errorRef.current('media'))
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
    controls={nativeControls}
    onError={(event) => { if (event.currentTarget.error && event.currentTarget.getAttribute('src')) onPlaybackError('media'); }}
    className="h-full w-full bg-black object-contain"
  >
    {source.subtitles.map((subtitle, index) => <track
      key={subtitle.url}
      kind="subtitles"
      src={subtitle.url}
      srcLang={subtitle.language ?? undefined}
      label={subtitle.title ?? subtitle.language ?? `Subtitles ${index + 1}`}
    />)}
  </video>;
}
