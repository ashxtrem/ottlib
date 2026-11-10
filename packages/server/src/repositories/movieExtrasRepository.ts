import type Database from 'better-sqlite3';
import type { OutsideRating } from '../providers/metadata/RatingsProvider.js';

/** A cast member as stored: photoUrl is a server-relative /media/people/ path, or null without a photo. */
export interface StoredCastMember { name: string; photoUrl: string | null }

export interface TitleExtras {
  castMembers: StoredCastMember[];
  logoFile: string | null;
  collection: { id: number; name: string } | null;
  trailerKey: string | null;
}

export interface StoredTitleExtras extends TitleExtras {
  ratings: OutsideRating[];
  ratingsFetchedAt: string | null;
  extrasFetchedAt: string | null;
}

const dayMs = 24 * 60 * 60 * 1000;

function parseList<T>(json: string | null): T[] {
  if (!json) return [];
  try { const value = JSON.parse(json); return Array.isArray(value) ? value : []; } catch { return []; }
}

// The provider extras and outside ratings of a title (columns of `movies` added by migration 024).
export class MovieExtrasRepository {
  public constructor(private readonly db: Database.Database) {}

  public applyExtras(id: number, extras: TitleExtras, now = new Date()): void {
    this.db.prepare(`UPDATE movies SET cast_members_json = @castMembers, logo_file = @logoFile, collection_id = @collectionId, collection_name = @collectionName,
      trailer_key = @trailerKey, extras_fetched_at = @now WHERE id = @id`).run({
      id, castMembers: JSON.stringify(extras.castMembers), logoFile: extras.logoFile, collectionId: extras.collection?.id ?? null,
      collectionName: extras.collection?.name ?? null, trailerKey: extras.trailerKey, now: now.toISOString()
    });
  }

  public applyRatings(id: number, ratings: OutsideRating[], now = new Date()): void {
    this.db.prepare('UPDATE movies SET ratings_json = ?, ratings_fetched_at = ? WHERE id = ?').run(JSON.stringify(ratings), now.toISOString(), id);
  }

  /** A ratings lookup failed: keeps any stored ratings and makes them due again after `retryDays` instead of on the next save. */
  public deferRatings(id: number, refreshDays: number, retryDays: number, now = new Date()): void {
    const stamp = new Date(now.getTime() - Math.max(refreshDays - retryDays, 0) * dayMs);
    this.db.prepare('UPDATE movies SET ratings_fetched_at = ? WHERE id = ?').run(stamp.toISOString(), id);
  }

  public extrasFor(id: number): StoredTitleExtras | undefined {
    const row = this.db.prepare(`SELECT cast_members_json, logo_file, collection_id, collection_name, trailer_key, ratings_json, ratings_fetched_at, extras_fetched_at
      FROM movies WHERE id = ?`).get(id) as Record<string, any> | undefined;
    if (!row) return undefined;
    return {
      castMembers: parseList<StoredCastMember>(row.cast_members_json), logoFile: row.logo_file ?? null,
      collection: row.collection_id === null || row.collection_id === undefined ? null : { id: row.collection_id, name: row.collection_name ?? '' },
      trailerKey: row.trailer_key ?? null, ratings: parseList<OutsideRating>(row.ratings_json),
      ratingsFetchedAt: row.ratings_fetched_at ?? null, extrasFetchedAt: row.extras_fetched_at ?? null
    };
  }

  /**
   * Matched, available titles whose extras were never fetched (a metadata refresh skips missing files). Only titles with a
   * provider id: a refresh of one without would reset and re-search the match, which the backfill must never do.
   */
  public idsMissingExtras(): number[] {
    return (this.db.prepare("SELECT id FROM movies WHERE metadata_status = 'matched' AND missing = 0 AND extras_fetched_at IS NULL AND metadata_source IS NOT NULL AND provider_id IS NOT NULL ORDER BY id").all() as Array<{ id: number }>).map((row) => row.id);
  }

  /** True when the ratings were never asked, or were asked more than `days` ago. */
  public ratingsDue(id: number, days: number, now = new Date()): boolean {
    const row = this.db.prepare('SELECT ratings_fetched_at FROM movies WHERE id = ?').get(id) as { ratings_fetched_at: string | null } | undefined;
    if (!row) return false;
    if (!row.ratings_fetched_at) return true;
    const fetched = Date.parse(row.ratings_fetched_at);
    return Number.isNaN(fetched) || now.getTime() - fetched >= days * dayMs;
  }
}
