import { describe, expect, it } from 'vitest';
import { chooseHlsEngine, isSafariUserAgent, playbackCapabilities, playbackQuery } from './browserCaps';

const only = (types: string[]) => (type: string) => types.includes(type);

describe('playbackCapabilities', () => {
  it('maps a Chrome-like answer set to codec names', () => {
    const chrome = only(['video/mp4', 'video/webm', 'video/mp4; codecs="avc1.640028"', 'video/mp4; codecs="av01.0.08M.08"', 'video/webm; codecs="vp9"', 'audio/mp4; codecs="mp4a.40.2"', 'audio/mpeg', 'audio/webm; codecs="opus"', 'audio/flac']);
    expect(playbackCapabilities(chrome, false)).toEqual({ containers: ['mp4', 'webm'], video: ['h264', 'av1', 'vp9'], audio: ['aac', 'mp3', 'opus', 'flac'], hdr: false });
  });

  it('offers hevc only when Main and Main 10 both decode', () => {
    const mainOnly = only(['video/mp4; codecs="hvc1.1.6.L120.90"']);
    const both = only(['video/mp4; codecs="hvc1.1.6.L120.90"', 'video/mp4; codecs="hvc1.2.4.L120.90"']);
    expect(playbackCapabilities(mainOnly, false).video).toEqual([]);
    expect(playbackCapabilities(both, true).video).toEqual(['hevc']);
  });

  it('maps Dolby audio and the HDR flag (Safari-like)', () => {
    const safari = only(['video/mp4', 'video/mp4; codecs="avc1.640028"', 'audio/mp4; codecs="mp4a.40.2"', 'audio/mp4; codecs="ac-3"', 'audio/mp4; codecs="ec-3"', 'audio/mp4; codecs="mp3"']);
    expect(playbackCapabilities(safari, true)).toEqual({ containers: ['mp4'], video: ['h264'], audio: ['aac', 'ac3', 'eac3', 'mp3'], hdr: true });
  });

  it('is empty when nothing plays', () => {
    expect(playbackCapabilities(() => false, false)).toEqual({ containers: [], video: [], audio: [], hdr: false });
  });
});

describe('chooseHlsEngine', () => {
  it('uses native HLS on Safari even with MSE', () => {
    expect(chooseHlsEngine({ nativeHls: true, mse: true, isSafari: true })).toBe('native');
  });
  it('prefers hls.js when a non-Safari browser claims native HLS', () => {
    expect(chooseHlsEngine({ nativeHls: true, mse: true, isSafari: false })).toBe('hlsjs');
  });
  it('falls back to native without MSE and to none without either', () => {
    expect(chooseHlsEngine({ nativeHls: true, mse: false, isSafari: false })).toBe('native');
    expect(chooseHlsEngine({ nativeHls: false, mse: true, isSafari: false })).toBe('hlsjs');
    expect(chooseHlsEngine({ nativeHls: false, mse: false, isSafari: false })).toBe('none');
  });
});

describe('isSafariUserAgent', () => {
  it('tells Safari and iOS browsers from Chromium', () => {
    expect(isSafariUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15')).toBe(true);
    expect(isSafariUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1')).toBe(true);
    expect(isSafariUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36')).toBe(false);
    expect(isSafariUserAgent('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0 Mobile Safari/537.36')).toBe(false);
  });
});

describe('playbackQuery', () => {
  const caps = { containers: ['mp4'], video: ['h264', 'hevc'], audio: ['aac'], hdr: false };
  it('joins lists with commas', () => {
    expect(playbackQuery(caps)).toBe('containers=mp4&video=h264%2Chevc&audio=aac&hdr=false');
  });
  it('adds switch fields', () => {
    const query = new URLSearchParams(playbackQuery(caps, { audioOrder: 1, burnSubtitleOrder: 0, startMs: 1234.6 }));
    expect([query.get('audioOrder'), query.get('burnSubtitleOrder'), query.get('startMs')]).toEqual(['1', '0', '1235']);
  });
});
