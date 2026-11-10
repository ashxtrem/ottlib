import type { TorrentResult } from '@ottlib/shared';

export type TorrentSort = 'best' | 'seeders' | 'size' | 'date';

/** Best match once any result has a score from the Settings preferences; seeders otherwise, as before scores existed. */
export function defaultTorrentSort(results: TorrentResult[]): TorrentSort {
  return results.some((result) => result.score !== null) ? 'best' : 'seeders';
}

export function torrentSortValue(result: TorrentResult, sort: TorrentSort): number {
  if (sort === 'best') return result.score ?? -1;
  if (sort === 'size') return result.fileSize ?? -1;
  if (sort === 'date') return result.publishedAt ? new Date(result.publishedAt).getTime() || -1 : -1;
  return result.nbSeeders && result.nbSeeders > 0 ? result.nbSeeders : -1;
}

export function sortTorrentResults(results: TorrentResult[], sort: TorrentSort): TorrentResult[] {
  return [...results].sort((left, right) => torrentSortValue(right, sort) - torrentSortValue(left, sort) || (sort === 'best' ? torrentSortValue(right, 'seeders') - torrentSortValue(left, 'seeders') : 0) || left.fileName.localeCompare(right.fileName));
}
