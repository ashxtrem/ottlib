import type Database from 'better-sqlite3';
import type { UpgradeCandidate } from '@ottlib/shared';
import { mapMovieListItem, movieSummarySelect, type MovieListItemRow } from './movieRepository.js';

export interface UpgradeCriteria {
  /** Titles shorter than this many pixels are candidates; null leaves the resolution reason off. */
  minimumHeight: number | null;
  /** Upper-case `movies.video_codec` labels that count as an old codec. */
  oldCodecs: readonly string[];
  limit: number;
}

/** Finds library titles worth replacing with a better release. The list card is mapped by `mapMovieListItem`. */
export class MovieUpgradeRepository {
  public constructor(private readonly db: Database.Database) {}

  /** Available titles under the minimum height or in an old codec, by title; resolution wins when both apply. */
  public listCandidates(profileId: number, criteria: UpgradeCriteria): UpgradeCandidate[] {
    const conditions: string[] = []; const values: unknown[] = [];
    if (criteria.minimumHeight !== null) { conditions.push('(m.video_height IS NOT NULL AND m.video_height > 0 AND m.video_height < ?)'); values.push(criteria.minimumHeight); }
    if (criteria.oldCodecs.length) { conditions.push(`UPPER(m.video_codec) IN (${criteria.oldCodecs.map(() => '?').join(', ')})`); values.push(...criteria.oldCodecs); }
    if (!conditions.length) return [];
    const rows = this.db.prepare(`${movieSummarySelect}
      WHERE m.missing = 0 AND (${conditions.join(' OR ')})
      ORDER BY COALESCE(m.title_override, m.metadata_title, m.parsed_title) COLLATE NOCASE ASC, m.id ASC LIMIT ?`)
      .all(profileId, ...values, criteria.limit) as MovieListItemRow[];
    return rows.map((row) => ({
      movie: mapMovieListItem(row),
      reason: criteria.minimumHeight !== null && row.video_height !== null && row.video_height > 0 && row.video_height < criteria.minimumHeight ? 'resolution' : 'codec'
    }));
  }
}
