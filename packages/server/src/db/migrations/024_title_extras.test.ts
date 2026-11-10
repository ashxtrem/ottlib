import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { ensureTitleExtras } from './024_title_extras.js';

const extrasColumns = ['cast_members_json', 'logo_file', 'collection_id', 'collection_name', 'trailer_key', 'ratings_json', 'ratings_fetched_at', 'extras_fetched_at'];

function preMigrationDb() {
  const db = new Database(':memory:');
  db.exec("CREATE TABLE movies (id INTEGER PRIMARY KEY, canonical_path TEXT NOT NULL, cast_json TEXT NOT NULL DEFAULT '[]')");
  db.prepare('INSERT INTO movies (canonical_path, cast_json) VALUES (?, ?)').run('E:/Movies/a.mkv', '["Actor"]');
  return db;
}

const columnNames = (db: Database.Database, table: string) => (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((column) => column.name);

describe('024 title extras', () => {
  it('adds the extras columns, keeps cast_json and creates collections', () => {
    const db = preMigrationDb();
    try {
      ensureTitleExtras(db);
      expect(columnNames(db, 'movies')).toEqual(expect.arrayContaining([...extrasColumns, 'cast_json']));
      expect(columnNames(db, 'collections')).toEqual(['collection_id', 'name', 'parts_json', 'fetched_at']);
      expect(db.prepare('SELECT cast_json, logo_file, extras_fetched_at FROM movies').get()).toEqual({ cast_json: '["Actor"]', logo_file: null, extras_fetched_at: null });
    } finally { db.close(); }
  });

  it('is idempotent and keeps stored values', () => {
    const db = preMigrationDb();
    try {
      ensureTitleExtras(db);
      db.prepare("UPDATE movies SET logo_file = 'logo.png', trailer_key = 'abc' WHERE id = 1").run();
      db.prepare("INSERT INTO collections (collection_id, name) VALUES (10, 'Saga')").run();
      ensureTitleExtras(db);
      expect(db.prepare('SELECT logo_file, trailer_key FROM movies WHERE id = 1').get()).toEqual({ logo_file: 'logo.png', trailer_key: 'abc' });
      expect(db.prepare('SELECT name, parts_json FROM collections').all()).toEqual([{ name: 'Saga', parts_json: '[]' }]);
      expect(columnNames(db, 'movies').filter((name) => name === 'logo_file')).toHaveLength(1);
    } finally { db.close(); }
  });
});
