import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { ensurePictureArea } from './022_picture_area.js';

function preMigrationDb() {
  const db = new Database(':memory:');
  db.exec('CREATE TABLE movies (id INTEGER PRIMARY KEY, canonical_path TEXT NOT NULL)');
  db.prepare('INSERT INTO movies (canonical_path) VALUES (?)').run('E:/Movies/a.mkv');
  db.prepare('INSERT INTO movies (canonical_path) VALUES (?)').run('E:/Movies/b.mkv');
  return db;
}

const columnNames = (db: Database.Database) => (db.prepare('PRAGMA table_info(movies)').all() as Array<{ name: string }>).map((column) => column.name);

describe('022 picture area', () => {
  it('adds the area columns and starts existing rows pending', () => {
    const db = preMigrationDb();
    try {
      ensurePictureArea(db);
      expect(columnNames(db)).toEqual(expect.arrayContaining(['picture_x', 'picture_y', 'picture_width', 'picture_height', 'picture_status']));
      expect(db.prepare('SELECT picture_x, picture_y, picture_width, picture_height, picture_status FROM movies ORDER BY id').all()).toEqual([
        { picture_x: null, picture_y: null, picture_width: null, picture_height: null, picture_status: 'pending' },
        { picture_x: null, picture_y: null, picture_width: null, picture_height: null, picture_status: 'pending' }
      ]);
    } finally { db.close(); }
  });

  it('is safe to run again and keeps stored values', () => {
    const db = preMigrationDb();
    try {
      ensurePictureArea(db);
      db.prepare("UPDATE movies SET picture_x = 0, picture_y = 264, picture_width = 3840, picture_height = 1632, picture_status = 'done' WHERE id = 1").run();
      ensurePictureArea(db);
      expect(db.prepare('SELECT picture_y, picture_status FROM movies WHERE id = 1').get()).toEqual({ picture_y: 264, picture_status: 'done' });
      expect(columnNames(db).filter((name) => name === 'picture_status')).toHaveLength(1);
    } finally { db.close(); }
  });
});
