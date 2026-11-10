import type Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../db/db.js';
import { MovieExtrasRepository } from './movieExtrasRepository.js';

const open: Array<{ db: Database.Database; dir: string }> = [];
afterEach(() => open.splice(0).forEach(({ db, dir }) => { db.close(); rmSync(dir, { force: true, recursive: true }); }));

function subject() {
  const dir = mkdtempSync(join(tmpdir(), 'ottlib-extras-'));
  const db = createDatabase(dir); open.push({ db, dir });
  db.prepare("INSERT INTO folders (path) VALUES ('E:/Movies')").run();
  const insert = db.prepare("INSERT INTO movies (folder_id, canonical_path, raw_filename, parsed_title, size, mtime_ms, last_seen_at, metadata_status) VALUES (1, ?, ?, ?, 1, 1, 'x', ?)");
  insert.run('E:/Movies/a.mkv', 'a.mkv', 'A', 'matched');
  insert.run('E:/Movies/b.mkv', 'b.mkv', 'B', 'matched');
  insert.run('E:/Movies/c.mkv', 'c.mkv', 'C', 'unmatched');
  return { db, extras: new MovieExtrasRepository(db) };
}

describe('MovieExtrasRepository', () => {
  it('stores and reads back cast, logo, collection and trailer', () => {
    const { db, extras } = subject();
    const now = new Date('2026-11-10T00:00:00.000Z');
    extras.applyExtras(1, { castMembers: [{ name: 'Actor', photoUrl: '/media/people/tmdb-person-abc.jpg' }], logoFile: 'tmdb-logo-xyz.png', collection: { id: 10, name: 'Saga' }, trailerKey: 'yt1' }, now);
    expect(extras.extrasFor(1)).toEqual({ castMembers: [{ name: 'Actor', photoUrl: '/media/people/tmdb-person-abc.jpg' }], logoFile: 'tmdb-logo-xyz.png', collection: { id: 10, name: 'Saga' },
      trailerKey: 'yt1', ratings: [], ratingsFetchedAt: null, extrasFetchedAt: now.toISOString() });
    expect(db.prepare('SELECT cast_json FROM movies WHERE id = 1').get()).toEqual({ cast_json: '[]' });
    expect(extras.extrasFor(99)).toBeUndefined();
  });

  it('lists matched titles still missing extras', () => {
    const { extras } = subject();
    expect(extras.idsMissingExtras()).toEqual([1, 2]);
    extras.applyExtras(2, { castMembers: [], logoFile: null, collection: null, trailerKey: null });
    expect(extras.idsMissingExtras()).toEqual([1]);
  });

  it('stores ratings and only asks again after the given days', () => {
    const { extras } = subject();
    const fetched = new Date('2026-11-01T00:00:00.000Z');
    expect(extras.ratingsDue(1, 30, fetched)).toBe(true);
    extras.applyRatings(1, [{ source: 'imdb', value: 8.8, max: 10 }], fetched);
    expect(extras.extrasFor(1)).toEqual(expect.objectContaining({ ratings: [{ source: 'imdb', value: 8.8, max: 10 }], ratingsFetchedAt: fetched.toISOString() }));
    expect(extras.ratingsDue(1, 30, new Date('2026-11-30T00:00:00.000Z'))).toBe(false);
    expect(extras.ratingsDue(1, 30, new Date('2026-12-01T00:00:00.000Z'))).toBe(true);
    expect(extras.ratingsDue(99, 30)).toBe(false);
  });
});
