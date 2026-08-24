import { describe, expect, it } from 'vitest';
import { releaseQuality } from './releaseQuality.js';

describe('releaseQuality', () => {
  it.each([
    ['Inception.2010.2160p.BluRay.x265-GROUP', { resolution: '2160p', source: 'BluRay', codec: 'x265', group: 'GROUP' }],
    ['Dune.Part.Two.2024.1080p.WEB-DL.H.264', { resolution: '1080p', source: 'WEB-DL', codec: 'H264', group: null }],
    ['Some.Movie.720p.WEBRip.HEVC-RARBG', { resolution: '720p', source: 'WEBRip', codec: 'HEVC', group: 'RARBG' }],
    ['Plain title', { resolution: null, source: null, codec: null, group: null }]
  ])('extracts quality from %s', (name, expected) => expect(releaseQuality(name)).toEqual(expected));
});
