import type Database from 'better-sqlite3';

// Title extras from the metadata provider and outside ratings. cast_json keeps the plain names (the actor filter reads it);
// cast_members_json holds { name, photoUrl } for the cast row. ratings_json holds OutsideRating[].
const extrasColumns: Array<[string, string]> = [
  ['cast_members_json', 'TEXT'],
  ['logo_file', 'TEXT'],
  ['collection_id', 'INTEGER'],
  ['collection_name', 'TEXT'],
  ['trailer_key', 'TEXT'],
  ['ratings_json', 'TEXT'],
  ['ratings_fetched_at', 'TEXT'],
  ['extras_fetched_at', 'TEXT']
];

const collectionsSchema = `
CREATE TABLE IF NOT EXISTS collections (
  collection_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  parts_json TEXT NOT NULL DEFAULT '[]',
  fetched_at TEXT
);
`;

export function ensureTitleExtras(db: Database.Database): void {
  const existing = new Set((db.prepare('PRAGMA table_info(movies)').all() as Array<{ name: string }>).map((column) => column.name));
  for (const [name, definition] of extrasColumns) {
    if (!existing.has(name)) db.exec(`ALTER TABLE movies ADD COLUMN ${name} ${definition}`);
  }
  db.exec(collectionsSchema);
}
