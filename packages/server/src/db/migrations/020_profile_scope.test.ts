import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../db.js';
import { initialMigration } from './001_initial.js';
import { shelvesMigration } from './005_shelves.js';
import { playbackProgressMigration } from './013_playback_progress.js';
import { ensurePlaybackCollection } from './016_playback_collection.js';
import { ensureProfiles } from './019_profiles.js';
import { ensureProfileScope } from './020_profile_scope.js';

const deviceA = '3f1c2a52-8a3b-4f0e-9a51-2d6f0f5d9c11';
const deviceB = '00000000-0000-4000-8000-000000000000';
const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })));

/** A library as it was before 020: progress and watch state keyed by device, rows from two devices. */
function deviceKeyedLibrary(): string {
  const directory = mkdtempSync(join(tmpdir(), 'ottlib-profile-scope-')); directories.push(directory);
  const db = new Database(join(directory, 'library.sqlite'));
  db.pragma('foreign_keys = ON');
  db.exec(initialMigration); db.exec(shelvesMigration); db.exec(playbackProgressMigration); ensurePlaybackCollection(db); ensureProfiles(db);
  db.prepare("INSERT INTO folders (path) VALUES ('E:/Movies')").run();
  for (const id of [1, 2, 3]) {
    db.prepare("INSERT INTO movies (id, folder_id, canonical_path, raw_filename, parsed_title, size, mtime_ms, last_seen_at) VALUES (?, 1, ?, ?, ?, 1, 1, 'x')").run(id, `E:/Movies/${id}.mkv`, `${id}.mkv`, `Movie ${id}`);
  }
  db.prepare("INSERT INTO shelves (name) VALUES ('MCU')").run();
  const progress = db.prepare('INSERT INTO playback_progress (movie_id, device_id, position_ms, duration_ms, updated_at, shelf_id) VALUES (?, ?, ?, ?, ?, ?)');
  progress.run(1, deviceA, 100_000, 900_000, '2026-01-01T00:00:00.000Z', null);
  progress.run(1, deviceB, 300_000, 900_000, '2026-02-01T00:00:00.000Z', 1);
  progress.run(2, deviceA, 50_000, 900_000, '2026-03-01T00:00:00.000Z', null);
  const watch = db.prepare('INSERT INTO movie_watch_state (movie_id, device_id, watched, updated_at) VALUES (?, ?, ?, ?)');
  watch.run(1, deviceA, 1, '2026-01-01 00:00:00');
  watch.run(1, deviceB, 0, '2026-02-01 00:00:00');
  watch.run(3, deviceB, 0, '2026-01-01 00:00:00');
  db.close();
  return directory;
}

const columns = (db: Database.Database, table: string) => (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string; notnull: number; pk: number }>);
const indexNames = (db: Database.Database) => (db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'").all() as Array<{ name: string }>).map((row) => row.name);

describe('020 profile scope migration', () => {
  it('moves device-keyed rows to the owner profile, keeping the newest progress and any watched mark', () => {
    const db = createDatabase(deviceKeyedLibrary());
    try {
      const owner = (db.prepare('SELECT id FROM profiles WHERE is_owner = 1').get() as { id: number }).id;
      expect(db.prepare('SELECT movie_id, profile_id, device_id, position_ms, updated_at, shelf_id FROM playback_progress ORDER BY movie_id').all()).toEqual([
        { movie_id: 1, profile_id: owner, device_id: deviceB, position_ms: 300_000, updated_at: '2026-02-01T00:00:00.000Z', shelf_id: 1 },
        { movie_id: 2, profile_id: owner, device_id: deviceA, position_ms: 50_000, updated_at: '2026-03-01T00:00:00.000Z', shelf_id: null }
      ]);
      expect(db.prepare('SELECT movie_id, profile_id, device_id, watched FROM movie_watch_state ORDER BY movie_id').all()).toEqual([
        { movie_id: 1, profile_id: owner, device_id: deviceA, watched: 1 },
        { movie_id: 3, profile_id: owner, device_id: deviceB, watched: 0 }
      ]);
      for (const table of ['playback_progress', 'movie_watch_state']) {
        const shape = columns(db, table);
        expect(shape.filter((column) => column.pk > 0).map((column) => column.name)).toEqual(['movie_id', 'profile_id']);
        expect(shape.find((column) => column.name === 'device_id')).toMatchObject({ notnull: 0, pk: 0 });
        expect(shape.map((column) => column.name)).toContain('shelf_id');
      }
      expect(indexNames(db)).toEqual(expect.arrayContaining(['idx_playback_progress_profile', 'idx_playback_progress_device', 'idx_movie_watch_state_profile']));
      expect(db.prepare("SELECT name FROM sqlite_master WHERE name LIKE '%_new'").all()).toEqual([]);
    } finally { db.close(); }
  });

  it('is idempotent: running again (and reopening) keeps the rows as they are', () => {
    const directory = deviceKeyedLibrary();
    const first = createDatabase(directory);
    const before = { progress: first.prepare('SELECT * FROM playback_progress ORDER BY movie_id').all(), watch: first.prepare('SELECT * FROM movie_watch_state ORDER BY movie_id').all() };
    ensureProfileScope(first); ensureProfileScope(first);
    first.close();
    const db = createDatabase(directory);
    try {
      expect(db.prepare('SELECT * FROM playback_progress ORDER BY movie_id').all()).toEqual(before.progress);
      expect(db.prepare('SELECT * FROM movie_watch_state ORDER BY movie_id').all()).toEqual(before.watch);
    } finally { db.close(); }
  });

  it('deletes a profile\'s progress and watched marks along with the profile', () => {
    const db = createDatabase(deviceKeyedLibrary());
    try {
      const kid = Number(db.prepare("INSERT INTO profiles (name, color, created_at) VALUES ('Kid', '#fff', 'x')").run().lastInsertRowid);
      db.prepare('INSERT INTO playback_progress (movie_id, profile_id, position_ms, duration_ms) VALUES (3, ?, 1, 2)').run(kid);
      db.prepare('INSERT INTO movie_watch_state (movie_id, profile_id, watched) VALUES (2, ?, 1)').run(kid);
      db.prepare('DELETE FROM profiles WHERE id = ?').run(kid);
      expect(db.prepare('SELECT COUNT(*) AS count FROM playback_progress WHERE profile_id = ?').get(kid)).toEqual({ count: 0 });
      expect(db.prepare('SELECT COUNT(*) AS count FROM movie_watch_state WHERE profile_id = ?').get(kid)).toEqual({ count: 0 });
      expect(db.prepare('SELECT COUNT(*) AS count FROM playback_progress').get()).toEqual({ count: 2 });
      expect(() => db.prepare('INSERT INTO playback_progress (movie_id, profile_id, position_ms, duration_ms) VALUES (1, 999, 1, 2)').run()).toThrow(/FOREIGN KEY/);
    } finally { db.close(); }
  });
});
