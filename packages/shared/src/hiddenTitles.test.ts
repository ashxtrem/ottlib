import { describe, expect, it } from 'vitest';
import { hiddenDisplayTitle, hideKeyOf } from './hiddenTitles.js';

describe('hidden titles', () => {
  it('hides a movie by id and a show by its show key', () => {
    expect(hideKeyOf({ id: 7, showKey: null })).toBe('m:7');
    expect(hideKeyOf({ id: 7, showKey: 'tv:imdb:tt0903747' })).toBe('tv:imdb:tt0903747');
  });

  it('shows the show name rather than the episode title', () => {
    expect(hiddenDisplayTitle('Breaking Bad · S1E2 · Cat’s in the Bag...', 'tv:imdb:tt0903747')).toBe('Breaking Bad');
    expect(hiddenDisplayTitle('Dune · Part Two', null)).toBe('Dune · Part Two');
  });
});
