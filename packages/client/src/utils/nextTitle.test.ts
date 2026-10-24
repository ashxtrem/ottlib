import { describe, expect, it } from 'vitest';
import { episodeGapAfter, nextLabel } from './nextTitle';

const episode = (season: number, number: number) => ({ mediaType: 'tv' as const, season, episode: number });

describe('nextLabel', () => {
  it('says Next episode for shows and Up next for movies', () => {
    expect(nextLabel({ mediaType: 'tv' })).toBe('Next episode');
    expect(nextLabel({ mediaType: 'movie' })).toBe('Up next');
    expect(nextLabel({ mediaType: null })).toBe('Up next');
  });
});

describe('episodeGapAfter', () => {
  it('is quiet for the very next episode or the first episode of the next season', () => {
    expect(episodeGapAfter(episode(1, 4), episode(1, 3))).toBeNull();
    expect(episodeGapAfter(episode(2, 1), episode(1, 8))).toBeNull();
  });

  it('notes skipped episodes and seasons', () => {
    expect(episodeGapAfter(episode(1, 5), episode(1, 3))).toBe('Some episodes are unavailable. Next available: S1E5.');
    expect(episodeGapAfter(episode(2, 2), episode(1, 8))).toBe('Some episodes are unavailable. Next available: S2E2.');
    expect(episodeGapAfter(episode(3, 1), episode(1, 8))).toBe('Some episodes are unavailable. Next available: S3E1.');
  });

  it('needs both titles to be numbered episodes', () => {
    expect(episodeGapAfter({ mediaType: 'movie', season: null, episode: null }, episode(1, 1))).toBeNull();
    expect(episodeGapAfter({ mediaType: 'tv', season: 1, episode: null }, episode(1, 1))).toBeNull();
  });
});
