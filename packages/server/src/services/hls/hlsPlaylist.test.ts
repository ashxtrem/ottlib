import { describe, expect, it } from 'vitest';
import { buildHlsPlaylist } from './hlsPlaylist.js';
import { planSegments } from './segmentPlan.js';

describe('buildHlsPlaylist', () => {
  it('writes a VOD playlist whose relative URIs carry the stream key query', () => {
    const plan = planSegments({ mode: 'remux', durationMs: 10_500, keyframesMs: [0, 2002, 4004, 8008] });
    expect(buildHlsPlaylist(plan, '?key=abc123')).toBe([
      '#EXTM3U',
      '#EXT-X-VERSION:7',
      '#EXT-X-PLAYLIST-TYPE:VOD',
      '#EXT-X-TARGETDURATION:5',
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-INDEPENDENT-SEGMENTS',
      '#EXT-X-MAP:URI="init.mp4?key=abc123"',
      '#EXTINF:2.002,',
      'seg-0.m4s?key=abc123',
      '#EXTINF:2.002,',
      'seg-1.m4s?key=abc123',
      '#EXTINF:4.004,',
      'seg-2.m4s?key=abc123',
      '#EXTINF:2.492,',
      'seg-3.m4s?key=abc123',
      '#EXT-X-ENDLIST',
      '',
    ].join('\n'));
  });

  it('writes bare URIs when no PIN is set', () => {
    const text = buildHlsPlaylist(planSegments({ mode: 'transcode', durationMs: 4000 }), '');
    expect(text).toContain('#EXT-X-MAP:URI="init.mp4"\n#EXTINF:4.000,\nseg-0.m4s\n#EXT-X-ENDLIST\n');
  });
});
