import type { CastMember, FreshMark, Movie, OutsideRating } from '@ottlib/shared';
import { FRESH_DAYS } from '../config/defaults.js';

/** The extras columns of a `movies` row (migration 024). */
export interface ExtrasColumns {
  cast_members_json: string | null; logo_file: string | null; collection_id: number | null; collection_name: string | null;
  trailer_key: string | null; ratings_json: string | null;
}

/** What the fresh rule reads from a row; `library_first_added_at` is MIN(added_at) over the whole library. */
export interface FreshColumns { added_at: string; watched: number; missing: number; library_first_added_at: string | null }

/** SQL fragment: the library's first added_at, for the fresh rule. */
export const libraryFirstAddedSql = '(SELECT MIN(added_at) FROM movies) AS library_first_added_at';

const dayMs = 24 * 60 * 60 * 1000;

function parseList<T>(json: string | null): T[] {
  if (!json) return [];
  try { const value = JSON.parse(json); return Array.isArray(value) ? value : []; } catch { return []; }
}

/** added_at is SQLite's "YYYY-MM-DD HH:MM:SS" (UTC) or an ISO string. */
function parseAddedAt(value: string): number {
  return Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value.replace(' ', 'T')}Z`);
}

export function extrasOf(row: ExtrasColumns): Pick<Movie, 'castMembers' | 'logoUrl' | 'ratings' | 'collection' | 'trailerKey'> {
  return {
    castMembers: parseList<CastMember>(row.cast_members_json),
    logoUrl: row.logo_file ? `/media/logos/${encodeURIComponent(row.logo_file)}` : null,
    ratings: parseList<OutsideRating>(row.ratings_json),
    collection: row.collection_id === null || row.collection_id === undefined ? null : { id: row.collection_id, name: row.collection_name ?? '' },
    trailerKey: row.trailer_key ?? null
  };
}

/**
 * 'new' when the title arrived within FRESH_DAYS, is unwatched and available, and did not come with the first import
 * (more than a day after the library's first title). Computed on the server so every client agrees.
 */
export function freshOf(row: FreshColumns, now = new Date()): FreshMark {
  if (row.watched || row.missing || !row.library_first_added_at) return null;
  const added = parseAddedAt(row.added_at); const first = parseAddedAt(row.library_first_added_at);
  if (Number.isNaN(added) || Number.isNaN(first)) return null;
  if (now.getTime() - added > FRESH_DAYS * dayMs) return null;
  return added - first > dayMs ? 'new' : null;
}
