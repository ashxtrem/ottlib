import { describe, expect, it } from 'vitest';
import { addRecentSearch, maxRecentSearches, parseRecentSearches, recentSearchesKey, removeRecentSearch } from './useRecentSearches';

describe('recent searches', () => {
  it('puts the newest first', () => {
    expect(addRecentSearch(addRecentSearch([], 'alien'), 'heat')).toEqual(['heat', 'alien']);
  });

  it('keeps only the newest eight', () => {
    let list: string[] = [];
    for (let index = 1; index <= 12; index++) list = addRecentSearch(list, `movie ${index}`);
    expect(list).toHaveLength(maxRecentSearches);
    expect(list[0]).toBe('movie 12');
    expect(list.at(-1)).toBe('movie 5');
  });

  it('moves a repeated search to the front instead of listing it twice', () => {
    expect(addRecentSearch(['heat', 'alien', 'dune'], 'Alien')).toEqual(['Alien', 'heat', 'dune']);
    expect(addRecentSearch(['heat', 'alien'], '  heat ')).toEqual(['heat', 'alien']);
  });

  it('ignores terms under two characters', () => {
    const list = ['heat'];
    expect(addRecentSearch(list, 'a')).toBe(list);
    expect(addRecentSearch(list, '  ')).toBe(list);
  });

  it('removes one entry', () => {
    expect(removeRecentSearch(['heat', 'alien'], 'heat')).toEqual(['alien']);
  });

  it('reads stored lists defensively', () => {
    expect(parseRecentSearches(null)).toEqual([]);
    expect(parseRecentSearches('not json')).toEqual([]);
    expect(parseRecentSearches('{"a":1}')).toEqual([]);
    expect(parseRecentSearches('["heat", 3, "x", "alien"]')).toEqual(['heat', 'alien']);
  });

  it('keeps a separate list per profile', () => {
    expect(recentSearchesKey(1)).toBe('ottlib-recent-searches:1');
    expect(recentSearchesKey(2)).not.toBe(recentSearchesKey(1));
  });
});
