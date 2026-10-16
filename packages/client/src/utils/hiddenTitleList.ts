import { hiddenDisplayTitle, hideKeyOf, type Movie } from '@ottlib/shared';

/** What the device remembers about a hidden title, so the hidden list needs no server round trip. */
export interface HiddenTitle { key: string; id: number; title: string; year: number | null; posterUrl: string | null; isShow: boolean }
export type HideableMovie = Pick<Movie, 'id' | 'title' | 'year' | 'posterUrl' | 'showKey'>;

const maxEntries = 2000;

export function parseHiddenTitles(raw: string | null): HiddenTitle[] {
  try {
    const parsed: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is HiddenTitle => typeof entry?.key === 'string' && Number.isInteger(entry.id) && typeof entry.title === 'string'
      && (entry.year === null || Number.isInteger(entry.year)) && (entry.posterUrl === null || typeof entry.posterUrl === 'string') && typeof entry.isShow === 'boolean');
  } catch { return []; }
}

export function toHiddenTitle(movie: HideableMovie): HiddenTitle {
  return { key: hideKeyOf(movie), id: movie.id, title: hiddenDisplayTitle(movie.title, movie.showKey), year: movie.year, posterUrl: movie.posterUrl, isShow: movie.showKey !== null };
}

export function withHidden(list: HiddenTitle[], movie: HideableMovie): HiddenTitle[] {
  const entry = toHiddenTitle(movie);
  return [...list.filter((existing) => existing.key !== entry.key), entry].slice(-maxEntries);
}

export function withoutHidden(list: HiddenTitle[], key: string): HiddenTitle[] {
  return list.filter((entry) => entry.key !== key);
}
