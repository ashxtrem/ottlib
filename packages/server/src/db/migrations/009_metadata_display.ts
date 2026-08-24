import type Database from 'better-sqlite3';

export function ensureMetadataDisplayFields(db: Database.Database): void {
  const columns = new Set((db.prepare('PRAGMA table_info(movies)').all() as Array<{ name: string }>).map((column) => column.name));
  if (!columns.has('metadata_title')) db.exec('ALTER TABLE movies ADD COLUMN metadata_title TEXT');
  if (!columns.has('metadata_year')) db.exec('ALTER TABLE movies ADD COLUMN metadata_year INTEGER');
  db.exec("UPDATE movies SET metadata_title = parsed_title, metadata_year = parsed_year WHERE metadata_title IS NULL AND metadata_status IN ('matched', 'suggested')");
}
