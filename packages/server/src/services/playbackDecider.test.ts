import { describe, expect, it } from 'vitest';
import type { MediaTrack, PlaybackRequest } from '@ottlib/shared';
import type { ProbedMediaInfo } from '../repositories/movieRepository.js';
import { audioTracksOf, chooseAudio, decidePlayback } from './playbackDecider.js';

const info = (overrides: Partial<ProbedMediaInfo> = {}): ProbedMediaInfo => ({
  container: 'MKV', durationMs: 7_200_000, width: 1920, height: 1080, videoCodec: 'H.264', videoProfile: 'High', videoBitRate: 8_000_000, hdrFormat: null, ...overrides
});
const track = (type: 'audio' | 'subtitle', order: number, codec: string, overrides: Partial<MediaTrack> = {}): MediaTrack => ({
  type, source: 'embedded', order, language: 'eng', title: null, codec, channels: type === 'audio' ? 6 : null, channelLayout: null, isDefault: false, isForced: false, isHearingImpaired: false, ...overrides
});

const chrome: PlaybackRequest = { containers: ['mp4', 'webm'], video: ['h264', 'vp9', 'av1'], audio: ['aac', 'mp3', 'opus', 'flac'], hdr: false };
const safari: PlaybackRequest = { containers: ['mp4'], video: ['h264', 'hevc'], audio: ['aac', 'ac3', 'eac3', 'mp3', 'flac'], hdr: true };
const ac3 = [track('audio', 1, 'AC-3', { isDefault: true })];
const aac = [track('audio', 1, 'AAC', { isDefault: true })];

interface Row { name: string; info: ProbedMediaInfo; tracks: MediaTrack[]; request: PlaybackRequest; hasKeyframes?: boolean; ffmpegAvailable?: boolean; filename?: string; expected: Record<string, unknown> }

const table: Row[] = [
  { name: 'MKV H.264 + AC-3 on Chrome: remux, audio to AAC', info: info(), tracks: ac3, request: chrome, expected: { mode: 'remux', audioOrder: 1, audioCopy: false, toneMap: false, reasons: ['container', 'audio-codec'] } },
  { name: 'MKV HEVC Main 10 HDR10 on an SDR Chrome: transcode with tone mapping', info: info({ videoCodec: 'HEVC', videoProfile: 'Main 10', hdrFormat: 'HDR10' }), tracks: ac3, request: chrome, expected: { mode: 'transcode', toneMap: true, reasons: ['container', 'video-codec', 'audio-codec', 'hdr'] } },
  { name: 'MP4 H.264 AAC: direct', info: info({ container: 'MP4' }), tracks: aac, request: chrome, expected: { mode: 'direct', audioOrder: 1, audioCopy: true, reasons: [] } },
  { name: 'PGS burn-in: transcode', info: info({ container: 'MP4' }), tracks: [...aac, track('subtitle', 2, 'PGS')], request: { ...chrome, burnSubtitleOrder: 2 }, expected: { mode: 'transcode', burnSubtitleOrder: 2, toneMap: false, reasons: ['burn-in'] } },
  { name: 'no Cues: transcode', info: info(), tracks: aac, request: chrome, hasKeyframes: false, expected: { mode: 'transcode', reasons: ['container', 'no-keyframes'] } },
  { name: 'no ffmpeg: direct with ffmpeg-missing', info: info(), tracks: ac3, request: chrome, ffmpegAvailable: false, expected: { mode: 'direct', toneMap: false, reasons: ['container', 'audio-codec', 'ffmpeg-missing'] } },
  { name: 'no ffmpeg but already playable: plain direct', info: info({ container: 'MP4' }), tracks: aac, request: chrome, ffmpegAvailable: false, expected: { mode: 'direct', reasons: [] } },
  { name: 'Safari with AC-3 in MKV: remux, audio copied', info: info({ videoCodec: 'HEVC', hdrFormat: 'HDR10' }), tracks: ac3, request: safari, expected: { mode: 'remux', audioCopy: true, toneMap: false, reasons: ['container'] } },
  { name: 'Safari with AC-3 in MP4: direct', info: info({ container: 'MP4' }), tracks: ac3, request: safari, expected: { mode: 'direct', audioCopy: true, reasons: [] } },
  { name: 'HDR file, client says hdr=true: HDR is fine, remux', info: info({ videoCodec: 'HEVC', hdrFormat: 'Dolby Vision' }), tracks: aac, request: { ...safari, containers: [] }, expected: { mode: 'remux', toneMap: false, reasons: ['container'] } },
  { name: 'no capabilities listed: transcode', info: info({ container: 'MP4' }), tracks: aac, request: {}, hasKeyframes: false, expected: { mode: 'transcode', reasons: ['container', 'video-codec', 'audio-codec'] } },
  { name: 'unknown codecs never match', info: info({ container: 'MP4', videoCodec: 'MPEG-4' }), tracks: [track('audio', 1, 'Vorbis')], request: { ...chrome, video: ['mpeg4'], audio: ['vorbis'] }, expected: { mode: 'transcode', reasons: ['video-codec', 'audio-codec'] } },
  { name: 'file without audio: direct when the video fits', info: info({ container: 'MKV', videoCodec: 'VP9' }), tracks: [], request: chrome, filename: 'clip.webm', expected: { mode: 'direct', audioOrder: null, reasons: [] } },
  { name: 'VP9 + Opus .webm (probed as MKV) on Chrome: direct', info: info({ container: 'MKV', videoCodec: 'VP9' }), tracks: [track('audio', 1, 'Opus', { isDefault: true })], request: chrome, filename: 'clip.WEBM', expected: { mode: 'direct', audioCopy: true, reasons: [] } },
  { name: '.webm with no ffmpeg: plain direct, no ffmpeg-missing', info: info({ container: 'MKV', videoCodec: 'VP9' }), tracks: [track('audio', 1, 'Opus', { isDefault: true })], request: chrome, filename: 'clip.webm', ffmpegAvailable: false, expected: { mode: 'direct', reasons: [] } },
  { name: '.mkv is not webm: still remux', info: info({ container: 'MKV', videoCodec: 'VP9' }), tracks: [track('audio', 1, 'Opus', { isDefault: true })], request: chrome, expected: { mode: 'remux', reasons: ['container'] } },
  { name: 'text subtitle cannot be burned in: ignored', info: info({ container: 'MP4' }), tracks: [...aac, track('subtitle', 2, 'SRT')], request: { ...chrome, burnSubtitleOrder: 2 }, expected: { mode: 'direct', burnSubtitleOrder: null, reasons: [] } }
];

describe('decidePlayback', () => {
  it.each(table)('$name', ({ info: probe, tracks, request, hasKeyframes = true, ffmpegAvailable = true, filename = 'movie.mkv', expected }) => {
    expect(decidePlayback({ info: probe, tracks, request, hasKeyframes, ffmpegAvailable, filename })).toMatchObject(expected);
  });

  it('plays a non-first requested audio track via remux or transcode, never direct', () => {
    const tracks = [track('audio', 1, 'AAC', { isDefault: true }), track('audio', 2, 'AAC', { language: 'fra' })];
    expect(decidePlayback({ info: info({ container: 'MP4' }), tracks, request: { ...chrome, audioOrder: 2 }, hasKeyframes: false, ffmpegAvailable: true, filename: 'movie.mp4' }))
      .toMatchObject({ mode: 'transcode', audioOrder: 2, audioCopy: true, reasons: ['audio-track', 'no-keyframes'] });
  });

  it('ignores a requested audio order that is not an audio track', () => {
    const tracks = [track('audio', 1, 'AAC'), track('audio', 2, 'AAC', { isDefault: true }), track('subtitle', 3, 'SRT')];
    expect(chooseAudio(tracks, 3)?.order).toBe(2);
    expect(chooseAudio(tracks, 9)?.order).toBe(2);
    expect(chooseAudio(tracks.map((item) => ({ ...item, isDefault: false })), undefined)?.order).toBe(1);
    expect(chooseAudio([], 1)).toBeUndefined();
  });

  it('lists embedded audio only, in stream order', () => {
    const tracks = [track('audio', 4, 'AAC'), track('audio', 1, 'AAC'), track('audio', 9, 'AAC', { source: 'external' }), track('subtitle', 2, 'SRT')];
    expect(audioTracksOf(tracks).map((item) => item.order)).toEqual([1, 4]);
  });

  it('treats the other image subtitle codecs as burn-in too', () => {
    for (const [order, codec] of [[2, 'VobSub'], [3, 'DVB_SUBTITLE'], [4, 'dvd_subtitle']] as const) {
      expect(decidePlayback({ info: info({ container: 'MP4' }), tracks: [...aac, track('subtitle', order, codec)], request: { ...chrome, burnSubtitleOrder: order }, hasKeyframes: true, ffmpegAvailable: true, filename: 'movie.mp4' }).mode).toBe('transcode');
    }
  });
});
