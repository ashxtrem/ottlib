import type Database from 'better-sqlite3';

export function ensureMetadataMediaType(db: Database.Database): void {
  const columns = new Set((db.prepare('PRAGMA table_info(movies)').all() as Array<{ name: string }>).map((column) => column.name));
  if (!columns.has('metadata_media_type')) db.exec('ALTER TABLE movies ADD COLUMN metadata_media_type TEXT');
}
