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
    // A scope picture (1920x800) is still 1080p: judge by the taller of the height and the width's 16:9 height.
    const resolution = criteria.minimumHeight === null ? null
      : `(m.video_height > 0 AND MAX(m.video_height, COALESCE(m.video_width, 0) * 9 / 16) < ${Math.trunc(criteria.minimumHeight)})`;
    const conditions: string[] = []; const values: unknown[] = [];
    if (resolution) conditions.push(resolution);
    if (criteria.oldCodecs.length) { conditions.push(`UPPER(m.video_codec) IN (${criteria.oldCodecs.map(() => '?').join(', ')})`); values.push(...criteria.oldCodecs); }
    if (!conditions.length) return [];
    const picked = this.db.prepare(`SELECT m.id, ${resolution ? `CASE WHEN ${resolution} THEN 'resolution' ELSE 'codec' END` : "'codec'"} AS reason
      FROM movies m WHERE m.missing = 0 AND (${conditions.join(' OR ')})
      ORDER BY COALESCE(m.title_override, m.metadata_title, m.parsed_title) COLLATE NOCASE ASC, m.id ASC LIMIT ?`)
      .all(...values, criteria.limit) as Array<{ id: number; reason: UpgradeCandidate['reason'] }>;
    if (!picked.length) return [];
    const rows = this.db.prepare(`${movieSummarySelect} WHERE m.id IN (${picked.map(() => '?').join(', ')})`)
      .all(profileId, ...picked.map((item) => item.id)) as MovieListItemRow[];
    const byId = new Map(rows.map((row) => [row.id, row]));
    return picked.flatMap((item) => {
      const row = byId.get(item.id);
      return row ? [{ movie: mapMovieListItem(row), reason: item.reason }] : [];
    });
  }
}
