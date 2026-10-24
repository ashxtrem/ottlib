import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { profileColors } from '@ottlib/shared';
import { MovieRepository } from '../../repositories/movieRepository.js';
import { createDatabase } from '../db.js';
import { ensureProfiles } from './019_profiles.js';

const directories: string[] = [];
function freshDb() {
  const directory = mkdtempSync(join(tmpdir(), 'ottlib-profiles-migration-')); directories.push(directory);
  return createDatabase(directory);
}

afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })));

describe('019 profiles migration', () => {
  it('creates the four tables and exactly one owner profile named Home', () => {
    const db = freshDb();
    try {
      const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>).map((row) => row.name);
      expect(tables).toEqual(expect.arrayContaining(['profiles', 'profile_sessions', 'movie_hides', 'playback_history']));
      const profiles = db.prepare('SELECT name, color, pin_hash, is_owner FROM profiles').all();
      expect(profiles).toEqual([{ name: 'Home', color: profileColors[0], pin_hash: null, is_owner: 1 }]);
    } finally { db.close(); }
  });

  it('is idempotent and never re-seeds once a profile exists', () => {
    const db = freshDb();
    try {
      ensureProfiles(db); ensureProfiles(db);
      expect(db.prepare('SELECT COUNT(*) AS count FROM profiles').get()).toEqual({ count: 1 });
      db.prepare("UPDATE profiles SET name = 'Family'").run();
      ensureProfiles(db);
      expect(db.prepare('SELECT name FROM profiles').all()).toEqual([{ name: 'Family' }]);
    } finally { db.close(); }
  });

  it('enforces case-insensitive unique profile names', () => {
    const db = freshDb();
    try {
      expect(() => db.prepare("INSERT INTO profiles (name, color, created_at) VALUES ('home', '#fff', 'x')").run()).toThrow(/UNIQUE/);
    } finally { db.close(); }
  });

  it('cascades a deleted profile to its sessions, hides and history', () => {
    const db = freshDb();
    try {
      db.prepare('INSERT INTO folders (path) VALUES (?)').run('E:/Movies');
      new MovieRepository(db).upsertScanned({ folderId: 1, path: 'E:/Movies/a.mkv', filename: 'a.mkv', title: 'A', year: 2024, size: 1, mtimeMs: 1, seenAt: '2026-01-01T00:00:00.000Z' });
      const kid = Number(db.prepare("INSERT INTO profiles (name, color, created_at) VALUES ('Kid', '#fff', 'x')").run().lastInsertRowid);
      db.prepare("INSERT INTO profile_sessions (token_hash, profile_id, created_at, last_seen_at) VALUES ('t', ?, 'x', 'x')").run(kid);
      db.prepare("INSERT INTO movie_hides (profile_id, hide_key, created_at) VALUES (?, 'm:1', 'x')").run(kid);
      db.prepare("INSERT INTO playback_history (profile_id, movie_id, method, started_at) VALUES (?, 1, 'm3u', 'x')").run(kid);
      db.prepare('DELETE FROM profiles WHERE id = ?').run(kid);
      for (const table of ['profile_sessions', 'movie_hides', 'playback_history']) {
        expect(db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()).toEqual({ count: 0 });
      }
      expect(db.prepare('SELECT COUNT(*) AS count FROM movies').get()).toEqual({ count: 1 });
    } finally { db.close(); }
  });
});
