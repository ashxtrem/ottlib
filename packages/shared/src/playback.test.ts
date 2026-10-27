import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { settingsSchema, transcodeEncoderSchema } from './index.js';
import { playbackRequestSchema, playbackSourceSchema } from './playback.js';

describe('playbackRequestSchema', () => {
  it('parses comma lists, trimming, lowercasing and dropping empties', () => {
    const parsed = playbackRequestSchema.parse({ containers: 'MP4, webm,,', video: 'h264,HEVC', audio: ' aac ,eac3' });
    expect(parsed.containers).toEqual(['mp4', 'webm']);
    expect(parsed.video).toEqual(['h264', 'hevc']);
    expect(parsed.audio).toEqual(['aac', 'eac3']);
  });

  it('parses booleans and coerces integers', () => {
    expect(playbackRequestSchema.parse({ hdr: 'true' }).hdr).toBe(true);
    expect(playbackRequestSchema.parse({ hdr: '1' }).hdr).toBe(true);
    expect(playbackRequestSchema.parse({ hdr: 'false' }).hdr).toBe(false);
    expect(playbackRequestSchema.parse({ hdr: '0' }).hdr).toBe(false);
    expect(playbackRequestSchema.parse({ maxHeight: '1080', audioOrder: '1', burnSubtitleOrder: '0', startMs: '90000' }))
      .toEqual({ maxHeight: 1080, audioOrder: 1, burnSubtitleOrder: 0, startMs: 90000 });
  });

  it('accepts an empty query and rejects bad values', () => {
    expect(playbackRequestSchema.parse({})).toEqual({});
    expect(playbackRequestSchema.safeParse({ hdr: 'maybe' }).success).toBe(false);
    expect(playbackRequestSchema.safeParse({ maxHeight: '-1' }).success).toBe(false);
    expect(playbackRequestSchema.safeParse({ startMs: '1.5' }).success).toBe(false);
  });
});

describe('playbackSourceSchema', () => {
  it('accepts the existing direct fixture unchanged', () => {
    const fixture = JSON.parse(readFileSync(new URL('../../../contract/fixtures/playback-source.json', import.meta.url), 'utf8'));
    expect(playbackSourceSchema.parse(fixture)).toEqual(fixture);
  });

  it('accepts an hls answer', () => {
    const hls = {
      kind: 'hls',
      streamUrl: '/api/movies/1/hls/abc/index.m3u8',
      mimeType: 'application/vnd.apple.mpegurl',
      durationMs: 6960000,
      resumePositionMs: null,
      subtitles: [],
      mode: 'transcode',
      reasons: ['video-codec'],
      sessionUrl: '/api/movies/1/hls/abc',
      audioTracks: [{ order: 0, language: 'eng', title: null, codec: 'eac3', channels: 6, isDefault: true }],
      audioOrder: 0,
      burnInSubtitles: [{ order: 0, language: 'eng', title: null, codec: 'hdmv_pgs_subtitle', isForced: false }],
      burnSubtitleOrder: 0,
      credits: { startMs: 6_700_000, source: 'chapter' },
      autoSkipCredits: true,
      framePreviewUrl: '/api/movies/1/frame?key=abc'
    };
    expect(playbackSourceSchema.parse(hls)).toEqual(hls);
  });

  it('carries a picture area as fractions, or null, or nothing', () => {
    const base = { kind: 'direct', streamUrl: '/api/stream/1', mimeType: 'video/mp4', durationMs: null, resumePositionMs: null, subtitles: [], credits: null, autoSkipCredits: false, framePreviewUrl: '/api/movies/1/frame?' };
    const pictureArea = { x: 0, y: 0.125, width: 1, height: 0.75 };
    expect(playbackSourceSchema.parse({ ...base, pictureArea }).pictureArea).toEqual(pictureArea);
    expect(playbackSourceSchema.parse({ ...base, pictureArea: null }).pictureArea).toBeNull();
    expect(playbackSourceSchema.parse(base).pictureArea).toBeUndefined();
    expect(playbackSourceSchema.safeParse({ ...base, pictureArea: { ...pictureArea, height: 1.5 } }).success).toBe(false);
  });

  it('requires the credits fields and refuses an unknown credits source', () => {
    const base = { kind: 'direct', streamUrl: '/api/stream/1', mimeType: 'video/mp4', durationMs: null, resumePositionMs: null, subtitles: [], autoSkipCredits: false, framePreviewUrl: '/api/movies/1/frame?' };
    expect(playbackSourceSchema.parse({ ...base, credits: { startMs: 1000, source: 'series' } }).credits).toEqual({ startMs: 1000, source: 'series' });
    expect(playbackSourceSchema.safeParse(base).success).toBe(false);
    expect(playbackSourceSchema.safeParse({ ...base, credits: { startMs: 1000, source: 'guess' } }).success).toBe(false);
  });
});

describe('transcodeEncoder setting', () => {
  it('accepts the known encoders only', () => {
    for (const value of ['auto', 'nvenc', 'qsv', 'amf', 'x264']) expect(transcodeEncoderSchema.safeParse(value).success).toBe(true);
    expect(transcodeEncoderSchema.safeParse('vaapi').success).toBe(false);
    expect(settingsSchema.shape.transcodeEncoder).toBe(transcodeEncoderSchema);
  });
});
