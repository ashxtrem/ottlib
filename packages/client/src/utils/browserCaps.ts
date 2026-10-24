import type { PlaybackRequest } from '@ottlib/shared';

/** What the browser says it can decode: `true` when canPlayType or MediaSource accepts the MIME type. */
export type CanPlay = (mimeType: string) => boolean;

export type PlaybackCapabilities = Required<Pick<PlaybackRequest, 'containers' | 'video' | 'audio' | 'hdr'>>;

/** Extra query fields sent when the viewer switches audio or subtitles mid-play. */
export type PlaybackSwitch = Pick<PlaybackRequest, 'audioOrder' | 'burnSubtitleOrder' | 'startMs'>;

export type HlsEngine = 'native' | 'hlsjs' | 'none';

export interface BrowserCaps {
  request: PlaybackCapabilities;
  /** `<video>` plays m3u8 itself (Safari, iOS, some Android browsers). */
  nativeHls: boolean;
  /** MediaSource (or ManagedMediaSource) exists, so hls.js can work. */
  mse: boolean;
  isSafari: boolean;
}

const anyOf = (canPlay: CanPlay, types: string[]): boolean => types.some((type) => canPlay(type));

/** Codec names per the server's decider: video h264,hevc,av1,vp9; audio aac,ac3,eac3,mp3,opus,flac; containers mp4,webm. */
const videoProbes: Record<string, (canPlay: CanPlay) => boolean> = {
  h264: (canPlay) => canPlay('video/mp4; codecs="avc1.640028"'),
  // HEVC files are mostly Main 10 (4K/HDR), so hevc is only offered when both profiles decode.
  hevc: (canPlay) => canPlay('video/mp4; codecs="hvc1.1.6.L120.90"') && canPlay('video/mp4; codecs="hvc1.2.4.L120.90"'),
  av1: (canPlay) => canPlay('video/mp4; codecs="av01.0.08M.08"'),
  vp9: (canPlay) => anyOf(canPlay, ['video/webm; codecs="vp9"', 'video/mp4; codecs="vp09.00.10.08"'])
};

const audioProbes: Record<string, (canPlay: CanPlay) => boolean> = {
  aac: (canPlay) => canPlay('audio/mp4; codecs="mp4a.40.2"'),
  ac3: (canPlay) => canPlay('audio/mp4; codecs="ac-3"'),
  eac3: (canPlay) => canPlay('audio/mp4; codecs="ec-3"'),
  mp3: (canPlay) => anyOf(canPlay, ['audio/mpeg', 'audio/mp4; codecs="mp3"']),
  opus: (canPlay) => anyOf(canPlay, ['audio/webm; codecs="opus"', 'audio/mp4; codecs="opus"']),
  flac: (canPlay) => anyOf(canPlay, ['audio/mp4; codecs="flac"', 'audio/flac'])
};

const containerProbes: Record<string, (canPlay: CanPlay) => boolean> = {
  mp4: (canPlay) => canPlay('video/mp4'),
  webm: (canPlay) => canPlay('video/webm')
};

const supported = (probes: Record<string, (canPlay: CanPlay) => boolean>, canPlay: CanPlay): string[] =>
  Object.entries(probes).filter(([, probe]) => probe(canPlay)).map(([name]) => name);

/** Pure mapping from the browser's answers to the playback query (containers, video, audio, hdr). */
export function playbackCapabilities(canPlay: CanPlay, hdr: boolean): PlaybackCapabilities {
  return { containers: supported(containerProbes, canPlay), video: supported(videoProbes, canPlay), audio: supported(audioProbes, canPlay), hdr };
}

/** Safari, or any iOS browser (they all run Safari's WebKit and its native HLS). */
export function isSafariUserAgent(userAgent: string): boolean {
  if (/iP(hone|ad|od)/.test(userAgent)) return true;
  return /safari/i.test(userAgent) && !/chrome|chromium|crios|fxios|edg|android|opr/i.test(userAgent);
}

/**
 * Safari (and browsers without MediaSource) play m3u8 natively; everyone else uses hls.js even when they claim native
 * support, since non-Safari native HLS (e.g. some Chromium builds) is less reliable.
 */
export function chooseHlsEngine(caps: Pick<BrowserCaps, 'nativeHls' | 'mse' | 'isSafari'>): HlsEngine {
  if (caps.nativeHls && (caps.isSafari || !caps.mse)) return 'native';
  if (caps.mse) return 'hlsjs';
  return 'none';
}

/** Query string for GET /api/movies/:id/playback (lists comma separated). */
export function playbackQuery(capabilities: PlaybackCapabilities, change: PlaybackSwitch = {}): string {
  const params = new URLSearchParams({
    containers: capabilities.containers.join(','),
    video: capabilities.video.join(','),
    audio: capabilities.audio.join(','),
    hdr: String(capabilities.hdr)
  });
  if (change.audioOrder !== undefined) params.set('audioOrder', String(change.audioOrder));
  if (change.burnSubtitleOrder !== undefined) params.set('burnSubtitleOrder', String(change.burnSubtitleOrder));
  if (change.startMs !== undefined) params.set('startMs', String(Math.max(0, Math.round(change.startMs))));
  return params.toString();
}

type MediaSourceLike = { isTypeSupported?: (type: string) => boolean } | undefined;

/** Thin probe of the running browser; everything it learns goes through the pure functions above. */
export function probeBrowserCaps(): BrowserCaps {
  const video = document.createElement('video');
  const scope = window as unknown as { MediaSource?: MediaSourceLike; ManagedMediaSource?: MediaSourceLike };
  const mediaSource = scope.MediaSource ?? scope.ManagedMediaSource;
  const canPlay: CanPlay = (type) => video.canPlayType(type) !== '' || Boolean(mediaSource?.isTypeSupported?.(type));
  const hdr = typeof window.matchMedia === 'function' && window.matchMedia('(dynamic-range: high)').matches;
  return {
    request: playbackCapabilities(canPlay, hdr),
    nativeHls: video.canPlayType('application/vnd.apple.mpegurl') !== '',
    mse: Boolean(mediaSource?.isTypeSupported),
    isSafari: isSafariUserAgent(navigator.userAgent)
  };
}
