import type { TorrentResult } from '@ottlib/shared';
import { describe, expect, it } from 'vitest';
import { defaultTorrentSort, sortTorrentResults } from './torrentSort';

function result(fileName: string, patch: Partial<TorrentResult> = {}): TorrentResult {
  return { fileName, fileSize: 1_000, fileUrl: `magnet:?${fileName}`, nbSeeders: 5, nbLeechers: 1, siteUrl: null, descrLink: null, engines: [], publishedAt: null, quality: { resolution: null, source: null, codec: null, group: null }, score: null, bestMatch: false, libraryStatus: 'new', ...patch };
}

describe('defaultTorrentSort', () => {
  it('is best match when any result has a score', () => {
    expect(defaultTorrentSort([result('a'), result('b', { score: 0 })])).toBe('best');
  });

  it('is seeders when no result has a score', () => {
    expect(defaultTorrentSort([result('a'), result('b')])).toBe('seeders');
    expect(defaultTorrentSort([])).toBe('seeders');
  });
});

describe('sortTorrentResults', () => {
  it('orders by score, then seeders, and puts unscored last', () => {
    const sorted = sortTorrentResults([result('low', { score: 40, nbSeeders: 99 }), result('none'), result('top-few', { score: 90, nbSeeders: 2 }), result('top-many', { score: 90, nbSeeders: 50 })], 'best');
    expect(sorted.map((item) => item.fileName)).toEqual(['top-many', 'top-few', 'low', 'none']);
  });

  it('keeps the seeders order as before', () => {
    const sorted = sortTorrentResults([result('b', { nbSeeders: 3 }), result('a', { nbSeeders: 30 }), result('c', { nbSeeders: null })], 'seeders');
    expect(sorted.map((item) => item.fileName)).toEqual(['a', 'b', 'c']);
  });
});
