import { extname } from 'node:path';
import type { MediaTrack, PlaybackMode, PlaybackRequest } from '@ottlib/shared';
import type { ProbedMediaInfo } from '../repositories/movieRepository.js';

/** ffprobe codec labels (as stored by `mediaProbeService`, lower-cased) to the names clients list in `video=` and `audio=`. Unknown labels never match. */
const videoVocabulary: Record<string, string> = { 'h.264': 'h264', h264: 'h264', 'h.265': 'hevc', hevc: 'hevc', av1: 'av1', vp9: 'vp9' };
const audioVocabulary: Record<string, string> = {
  aac: 'aac', 'ac-3': 'ac3', ac3: 'ac3', 'e-ac-3': 'eac3', eac3: 'eac3', mp3: 'mp3', opus: 'opus', flac: 'flac', dts: 'dts', truehd: 'truehd'
};
/** Probed container label (lower-cased) to the names a client may list in `containers=`; only these can be played as they are. */
const directContainers: Record<string, readonly string[]> = { mp4: ['mp4', 'm4v', 'mov'], webm: ['webm'] };
/** Picture-based subtitle codecs (as labelled by the probe), which only show by being burned into the video. */
const imageSubtitleCodecs = new Set(['pgs', 'hdmv_pgs_subtitle', 'vobsub', 'dvd_subtitle', 'dvb_subtitle']);

export interface PlaybackDecision {
  mode: PlaybackMode;
  /** ffprobe stream index of the audio track to play; null when the file has no audio. */
  audioOrder: number | null;
  /** True when the client plays the chosen audio codec as is; false means re-encode it to AAC (remux/transcode only). */
  audioCopy: boolean;
  /** ffprobe stream index of the image subtitle to burn in, or null. */
  burnSubtitleOrder: number | null;
  /** HDR video for a client that cannot show HDR. */
  toneMap: boolean;
  reasons: string[];
}

export interface DecideInput {
  info: ProbedMediaInfo;
  tracks: MediaTrack[];
  /** A keyframe index could be read, so copy-mode segments can be cut. */
  hasKeyframes: boolean;
  ffmpegAvailable: boolean;
  request: PlaybackRequest;
  /** The file's name; the probe labels .webm as 'MKV' (same Matroska family), so the extension tells them apart. */
  filename: string;
}

/** The probed container label, lower-cased, with a Matroska file named .webm told apart as 'webm'. */
function containerKey(container: string | null | undefined, filename: string): string {
  const label = container?.toLowerCase() ?? '';
  return label === 'mkv' && extname(filename).toLowerCase() === '.webm' ? 'webm' : label;
}

export function isImageSubtitle(track: MediaTrack): boolean {
  return track.type === 'subtitle' && imageSubtitleCodecs.has(track.codec?.toLowerCase() ?? '');
}

/** The embedded audio tracks, in file order. */
export function audioTracksOf(tracks: MediaTrack[]): MediaTrack[] {
  return tracks.filter((track) => track.type === 'audio' && track.source === 'embedded').sort((a, b) => a.order - b.order);
}

/** The requested audio track if it exists, else the default one, else the first. */
export function chooseAudio(tracks: MediaTrack[], requested: number | undefined): MediaTrack | undefined {
  const audio = audioTracksOf(tracks);
  return audio.find((track) => track.order === requested) ?? audio.find((track) => track.isDefault) ?? audio[0];
}

function inList(list: string[] | undefined, vocabulary: Record<string, string>, codec: string | null | undefined): boolean {
  const name = vocabulary[codec?.toLowerCase() ?? ''];
  return name !== undefined && (list ?? []).includes(name);
}

/** Decides how a file reaches a client with the given capabilities: as it is, repackaged without re-encoding the video, or transcoded. */
export function decidePlayback({ info, tracks, hasKeyframes, ffmpegAvailable, request, filename }: DecideInput): PlaybackDecision {
  const audio = audioTracksOf(tracks); const chosen = chooseAudio(tracks, request.audioOrder);
  const burn = tracks.find((track) => track.source === 'embedded' && track.order === request.burnSubtitleOrder && isImageSubtitle(track));
  const isHdr = Boolean(info.hdrFormat); const hdrOk = !isHdr || request.hdr === true;
  const containerOk = (directContainers[containerKey(info.container, filename)] ?? []).some((name) => (request.containers ?? []).includes(name));
  const videoOk = inList(request.video, videoVocabulary, info.videoCodec);
  const audioCopy = chosen ? inList(request.audio, audioVocabulary, chosen.codec) : true;
  const reasons: string[] = [];
  if (!containerOk) reasons.push('container');
  if (!videoOk) reasons.push('video-codec');
  if (chosen && chosen !== audio[0]) reasons.push('audio-track');
  else if (!audioCopy) reasons.push('audio-codec');
  if (burn) reasons.push('burn-in');
  if (!hdrOk) reasons.push('hdr');
  const result = (mode: PlaybackMode, extra: Partial<PlaybackDecision> = {}): PlaybackDecision => ({
    mode, audioOrder: chosen?.order ?? null, audioCopy, burnSubtitleOrder: burn?.order ?? null, toneMap: false, reasons, ...extra
  });
  if (!reasons.length) return result('direct');
  if (!ffmpegAvailable) return result('direct', { burnSubtitleOrder: null, reasons: [...reasons, 'ffmpeg-missing'] });
  const copyable = videoOk && hdrOk && !burn;
  if (copyable && hasKeyframes) return result('remux');
  if (copyable) reasons.push('no-keyframes');
  return result('transcode', { toneMap: isHdr && request.hdr !== true });
}
