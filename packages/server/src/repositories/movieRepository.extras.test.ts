import type Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../db/db.js';
import { freshOf } from './movieExtrasMapping.js';
import { MovieExtrasRepository } from './movieExtrasRepository.js';
import { MovieRepository } from './movieRepository.js';

const open: Array<{ db: Database.Database; dir: string }> = [];
afterEach(() => open.splice(0).forEach(({ db, dir }) => { db.close(); rmSync(dir, { force: true, recursive: true }); }));

const dayMs = 24 * 60 * 60 * 1000;
const sqliteStamp = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');

/** The first title was added 100 days ago (the library's first import); `addedDaysAgo` lists the others. */
function subject(addedDaysAgo: number[] = []) {
  const dir = mkdtempSync(join(tmpdir(), 'ottlib-movie-extras-')); const db = createDatabase(dir); open.push({ db, dir });
  db.prepare('INSERT INTO folders (path) VALUES (?)').run('E:/Movies');
  const movies = new MovieRepository(db);
  const ids = [100, ...addedDaysAgo].map((days, index) => {
    const { id } = movies.upsertScanned({ folderId: 1, path: `E:/Movies/t${index}.mkv`, filename: `t${index}.mkv`, title: `Title ${index}`, year: 2024, size: 1, mtimeMs: 1, seenAt: '2026-01-01T00:00:00.000Z' });
    db.prepare('UPDATE movies SET added_at = ? WHERE id = ?').run(sqliteStamp(Date.now() - days * dayMs), id);
    return id;
  });
  return { db, movies, extras: new MovieExtrasRepository(db), ids };
}

describe('movie extras in the API shape', () => {
  it('returns empty extras for a title that has none', () => {
    const { movies, ids } = subject();
    expect(movies.get(ids[0])).toMatchObject({ castMembers: [], logoUrl: null, ratings: [], collection: null, trailerKey: null, fresh: null });
  });

  it('maps the stored extras to server-relative urls', () => {
    const { movies, extras, ids } = subject();
    extras.applyExtras(ids[0], { castMembers: [{ name: 'Ann', photoUrl: '/media/people/tmdb-person-a.jpg' }, { name: 'Bo', photoUrl: null }], logoFile: 'tmdb-logo-x.png', collection: { id: 9, name: 'Saga' }, trailerKey: 'yt1' });
    extras.applyRatings(ids[0], [{ source: 'imdb', value: 7.5, max: 10 }, { source: 'rottenTomatoes', value: 88, max: 100 }]);
    expect(movies.get(ids[0])).toMatchObject({
      castMembers: [{ name: 'Ann', photoUrl: '/media/people/tmdb-person-a.jpg' }, { name: 'Bo', photoUrl: null }], logoUrl: '/media/logos/tmdb-logo-x.png',
      collection: { id: 9, name: 'Saga' }, trailerKey: 'yt1', ratings: [{ source: 'imdb', value: 7.5, max: 10 }, { source: 'rottenTomatoes', value: 88, max: 100 }]
    });
    expect(movies.list(undefined, {})[0]).toHaveProperty('castMembers');
  });
});

describe('fresh mark', () => {
  it('marks a recent unwatched title that came after the first import day, and only that', () => {
    const { movies, db, ids } = subject([3, 20, 3]);
    const [first, recent, old, watched] = ids;
    db.prepare('INSERT INTO movie_watch_state (movie_id, profile_id, device_id, watched) VALUES (?, 1, ?, 1)').run(watched, 'd');
    const fresh = (id: number) => movies.get(id, 1)?.fresh;
    expect(fresh(first)).toBeNull();
    expect(fresh(recent)).toBe('new');
    expect(fresh(old)).toBeNull();
    expect(fresh(watched)).toBeNull();
    expect(movies.summariesByIds([first, recent, old, watched], 1).map((item) => item.fresh)).toEqual([null, 'new', null, null]);
    expect(movies.listSummaries(1, { sort: 'added' }).items.map((item) => [item.id, item.fresh]).sort()).toEqual([[first, null], [recent, 'new'], [old, null], [watched, null]].sort());
  });

  it('is per profile: watched by another profile still shows as new', () => {
    const { movies, db, ids } = subject([2]);
    db.prepare("INSERT INTO profiles (name, color, is_owner, created_at) VALUES ('Kid', '#fff', 0, '2026-01-01T00:00:00Z')").run();
    const other = (db.prepare('SELECT id FROM profiles ORDER BY id DESC LIMIT 1').get() as { id: number }).id;
    db.prepare('INSERT INTO movie_watch_state (movie_id, profile_id, device_id, watched) VALUES (?, ?, ?, 1)').run(ids[1], other, 'd');
    expect(movies.get(ids[1], other)?.fresh).toBeNull();
    expect(movies.get(ids[1], 1)?.fresh).toBe('new');
  });

  it('skips missing files and titles from the first import day', () => {
    const { movies, db, ids } = subject([2, 100]);
    expect(movies.get(ids[2])?.fresh).toBeNull(); // added within a day of the library's first title
    db.prepare('UPDATE movies SET missing = 1 WHERE id = ?').run(ids[1]);
    expect(movies.get(ids[1])?.fresh).toBeNull();
  });
});

describe('freshOf', () => {
  const now = new Date('2026-11-10T12:00:00Z');
  const row = (addedAt: string, extra = {}) => ({ added_at: addedAt, watched: 0, missing: 0, library_first_added_at: '2026-01-01 00:00:00', ...extra });

  it('uses the 14-day window and the one-day first-import window', () => {
    expect(freshOf(row('2026-10-28 12:00:00'), now)).toBe('new');
    expect(freshOf(row('2026-10-27 11:00:00'), now)).toBeNull();
    expect(freshOf(row('2026-01-01 20:00:00'), now)).toBeNull();
    expect(freshOf(row('2026-11-09T12:00:00.000Z'), now)).toBe('new');
    expect(freshOf(row('2026-11-09 12:00:00', { watched: 1 }), now)).toBeNull();
  });

  it('is null when the library has no first title or the date is unreadable', () => {
    expect(freshOf(row('2026-11-09 12:00:00', { library_first_added_at: null }), now)).toBeNull();
    expect(freshOf(row('not a date'), now)).toBeNull();
  });
});
