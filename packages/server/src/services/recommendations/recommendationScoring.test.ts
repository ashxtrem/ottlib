import { describe, expect, it } from 'vitest';
import { franchiseKey, genreFrequencies, genreSimilarity, rank, scoreCandidate, sharedCast, type PoolTitle } from './recommendationScoring.js';

function title(id: number, name: string, extra: Partial<PoolTitle> = {}): PoolTitle {
  return { id, title: name, year: 2000, genres: [], cast: [], rating: null, mediaType: 'movie', showKey: null, imdbId: null, provider: 'tmdb', providerId: String(id), season: null, episode: null, ...extra };
}

describe('franchiseKey', () => {
  it('groups sequels and subtitled entries, but not short or unrelated names', () => {
    expect(franchiseKey('Alien 3')).toBe('alien');
    expect(franchiseKey('Alien: Resurrection')).toBe('alien');
    expect(franchiseKey('Rocky II')).toBe('rocky');
    expect(franchiseKey('Toy Story Part 2')).toBe('toy story');
    expect(franchiseKey('Blade Runner 2049')).toBe('blade runner');
    expect(franchiseKey('Up')).toBe('');
    expect(franchiseKey('Heat')).toBe('heat');
    expect(franchiseKey('Heat')).not.toBe(franchiseKey('Heathers'));
  });
});

describe('genre and cast similarity', () => {
  const pool = [title(1, 'A', { genres: ['Drama', 'Sci-Fi'] }), title(2, 'B', { genres: ['Drama'] }), title(3, 'C', { genres: ['Drama'] }), title(4, 'D', { genres: ['Drama', 'Western'] })];
  const frequencies = genreFrequencies(pool);

  it('counts a shared rare genre for more than a shared common one', () => {
    const rare = genreSimilarity(['Drama', 'Sci-Fi'], ['Sci-Fi', 'Western'], frequencies, pool.length).score;
    const common = genreSimilarity(['Drama', 'Sci-Fi'], ['Drama', 'Western'], frequencies, pool.length).score;
    expect(rare).toBeGreaterThan(common);
  });

  it('only counts top-billed cast', () => {
    const many = Array.from({ length: 12 }, (_, index) => `Actor ${index}`);
    expect(sharedCast(many, ['Actor 0', 'Actor 11'])).toEqual(['Actor 0']);
  });
});

describe('scoreCandidate', () => {
  const anchor = title(1, 'Blade Runner', { genres: ['Sci-Fi', 'Thriller'], cast: ['Harrison Ford'], year: 1982, rating: 8 });
  const sequel = title(2, 'Blade Runner 2049', { genres: ['Sci-Fi', 'Drama'], cast: ['Harrison Ford'], year: 2017, rating: 8 });
  const similar = title(3, 'Ex Machina', { genres: ['Sci-Fi', 'Thriller'], year: 2014, rating: 7.7 });
  const unrelated = title(4, 'Paddington', { genres: ['Family', 'Comedy'], year: 1983, rating: 8 });
  const pool = [anchor, sequel, similar, unrelated];
  const frequencies = genreFrequencies(pool);
  const score = (candidate: PoolTitle, signal = null as Parameters<typeof scoreCandidate>[4]) => scoreCandidate(anchor, candidate, frequencies, pool.length, signal);

  it('puts the same franchise first and drops titles that share nothing', () => {
    const ranked = rank(pool.slice(1).map((candidate) => score(candidate)));
    expect(ranked.map((entry) => entry.title.id)).toEqual([2, 3]);
    expect(ranked[0].reason).toBe('Same franchise');
    expect(ranked[1].reason).toBe('Shares genres: Thriller, Sci-Fi');
  });

  it('is not enough to be from the same era with a similar rating', () => {
    expect(score(unrelated).score).toBe(0);
  });

  it('lets the provider signal lift a title and explain it', () => {
    const signal = { size: 4, rankOf: (candidate: PoolTitle) => (candidate.id === 4 ? 0 : undefined) };
    const lifted = score(unrelated, signal);
    expect(lifted.score).toBeGreaterThan(0.2);
    expect(lifted.reason).toBe('Viewers of this title also liked it');
  });

  it('ranks a title below a show-vs-movie mismatch of equal overlap', () => {
    const show = title(5, 'Black Mirror', { genres: ['Sci-Fi', 'Thriller'], year: 2014, rating: 7.7, mediaType: 'tv' });
    expect(score(show).score).toBeLessThan(score(similar).score);
  });
});
