import type Database from 'better-sqlite3';

export function ensureCandidateEpisode(db: Database.Database): void {
  const columns = new Set((db.prepare('PRAGMA table_info(movie_match_candidates)').all() as Array<{ name: string }>).map((column) => column.name));
  if (!columns.has('season')) db.exec('ALTER TABLE movie_match_candidates ADD COLUMN season INTEGER');
  if (!columns.has('episode')) db.exec('ALTER TABLE movie_match_candidates ADD COLUMN episode INTEGER');
}
