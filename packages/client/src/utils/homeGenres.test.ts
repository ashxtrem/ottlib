import { describe, expect, it } from 'vitest';
import { homeGenres } from './homeGenres';

describe('homeGenres', () => {
  it('puts familiar genres first, then the rest alphabetically', () => {
    expect(homeGenres(['Western', 'Drama', 'Action', 'Anime'], 4)).toEqual(['Action', 'Drama', 'Anime', 'Western']);
  });

  it('returns nothing for an empty library', () => {
    expect(homeGenres([])).toEqual([]);
  });
});
