import { describe, expect, it } from 'vitest';
import { parseHiddenTitles, withHidden, withoutHidden } from './hiddenTitleList';

const movie = { id: 1, title: 'Alien', year: 1979, posterUrl: '/media/posters/a.jpg', showKey: null };
const episode = { id: 9, title: 'Severance · S1E2 · Half Loop', year: 2022, posterUrl: null, showKey: 'tv:imdb:tt11280740' };

describe('hidden title list', () => {
  it('hides a movie by id and a show once, however many episodes are hidden', () => {
    const list = withHidden(withHidden(withHidden([], movie), episode), { ...episode, id: 10, title: 'Severance · S1E3 · In Perpetuity' });
    expect(list.map((entry) => entry.key)).toEqual(['m:1', 'tv:imdb:tt11280740']);
    expect(list[1]).toMatchObject({ title: 'Severance', isShow: true, id: 10 });
  });

  it('unhides by key', () => {
    expect(withoutHidden(withHidden([], movie), 'm:1')).toEqual([]);
  });

  it('ignores corrupt storage', () => {
    expect(parseHiddenTitles('not json')).toEqual([]);
    expect(parseHiddenTitles('{"a":1}')).toEqual([]);
    expect(parseHiddenTitles(JSON.stringify([{ key: 'm:1' }, withHidden([], movie)[0]]))).toHaveLength(1);
    expect(parseHiddenTitles(null)).toEqual([]);
  });
});
