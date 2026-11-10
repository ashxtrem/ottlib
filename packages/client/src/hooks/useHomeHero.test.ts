import { describe, expect, it } from 'vitest';
import type { MovieListItem } from '@ottlib/shared';
import type { HomeRow } from './useHomeRows';
import { pickHeroItem } from './useHomeHero';

const item = (id: number, title: string): MovieListItem => ({ id, title, year: 2020, posterUrl: null, resolution: null, hdrFormat: null, watched: false, resumePositionMs: null, durationMs: null, missing: false, metadataStatus: 'matched', shelves: [], showKey: null, fresh: null });
const row = (key: string, items: MovieListItem[]): HomeRow => ({ key, title: key, items });

describe('pickHeroItem', () => {
  it('features the first Continue watching title', () => {
    expect(pickHeroItem([row('continue', [item(1, 'Arrival'), item(2, 'Dune')]), row('recent', [item(3, 'Heat')]), row('unwatched', [item(4, 'Alien')])])?.id).toBe(1);
  });

  it('falls back to the newest unwatched title, skipping other rows', () => {
    expect(pickHeroItem([row('recent', [item(3, 'Heat')]), row('unwatched', [item(4, 'Alien'), item(5, 'Ran')]), row('genre-Drama', [item(6, 'Up')])])?.id).toBe(4);
  });

  it('never features a hidden title', () => {
    const hidden = new Set([1, 2, 4]);
    const rows = [row('continue', [item(1, 'Arrival'), item(2, 'Dune')]), row('unwatched', [item(4, 'Alien'), item(5, 'Ran')])];
    expect(pickHeroItem(rows, (movie) => hidden.has(movie.id))?.id).toBe(5);
    expect(pickHeroItem([row('continue', [item(1, 'Arrival')])], (movie) => hidden.has(movie.id))).toBeNull();
  });

  it('is null with no rows', () => {
    expect(pickHeroItem(undefined)).toBeNull();
    expect(pickHeroItem([])).toBeNull();
    expect(pickHeroItem([row('recent', [item(3, 'Heat')])])).toBeNull();
  });
});
