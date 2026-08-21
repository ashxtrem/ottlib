import type Database from 'better-sqlite3';

export function ensureCandidateMediaType(db: Database.Database): void {
  const columns = db.prepare('PRAGMA table_info(movie_match_candidates)').all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === 'media_type')) {
    db.exec("ALTER TABLE movie_match_candidates ADD COLUMN media_type TEXT NOT NULL DEFAULT 'movie'");
  }
}
