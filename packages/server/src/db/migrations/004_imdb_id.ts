import type Database from 'better-sqlite3';

export function ensureImdbId(db: Database.Database): void {
  const columns = db.prepare('PRAGMA table_info(movies)').all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === 'imdb_id')) {
    db.exec('ALTER TABLE movies ADD COLUMN imdb_id TEXT');
  }
}
