import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { createDatabase } from '../db/db.js';
import { MovieRepository } from '../repositories/movieRepository.js';

const deviceA = '3f1c2a52-8a3b-4f0e-9a51-2d6f0f5d9c11';
const deviceB = '00000000-0000-4000-8000-000000000000';
const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })));

/** A movie (1) and two episodes of a show (2, 3), owner profile only. */
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'ottlib-profile-scope-')); directories.push(directory);
  const db = createDatabase(directory); db.prepare('INSERT INTO folders (path) VALUES (?)').run('E:/Media');
  const movies = new MovieRepository(db);
  movies.upsertScanned({ folderId: 1, path: 'E:/Media/movie.mkv', filename: 'movie.mkv', title: 'Movie', year: 2024, size: 1, mtimeMs: 1, seenAt: '2026-01-01T00:00:00.000Z' });
  for (const id of [2, 3]) {
    movies.upsertScanned({ folderId: 1, path: `E:/Media/${id}.mkv`, filename: `${id}.mkv`, title: 'Show', year: 2024, size: 1, mtimeMs: 1, seenAt: '2026-01-01T00:00:00.000Z' });
    movies.applyMetadata(id, { source: 'tmdb', providerId: '1', mediaType: 'tv', season: 1, episode: id - 1, title: `Show · S1E${id - 1}`, year: 2024, overview: null, posterFile: null, backdropFile: null, genres: [], cast: [], rating: null, runtime: 24, imdbId: null });
  }
  return { app: buildApp(db, directory, 0), db };
}

type App = ReturnType<typeof fixture>['app'];
async function signIn(app: App, id: number): Promise<string> { return (await app.inject({ method: 'POST', url: `/api/profiles/${id}/select`, payload: {} })).json().token; }
/** Owner (A) and Kid (B) sessions, after the library had only the owner. */
async function twoProfiles(app: App) {
  const owner = ((await app.inject({ method: 'GET', url: '/api/profiles' })).json() as Array<{ id: number }>)[0].id;
  const kid = (await app.inject({ method: 'POST', url: '/api/profiles', payload: { name: 'Kid', color: '#17c964' } })).json().id as number;
  const a = await signIn(app, owner); const b = await signIn(app, kid);
  return { a: (device = deviceA) => ({ 'x-profile-session': a, 'x-device-id': device }), b: { 'x-profile-session': b, 'x-device-id': deviceB } };
}
const progress = { positionMs: 1_800_000, durationMs: 6_000_000 };

describe('profile-scoped lists', () => {
  it('keeps progress, continue watching, watched marks and next-up per profile, shared across one profile\'s devices', async () => {
    const { app, db } = fixture();
    try {
      const { a, b } = await twoProfiles(app);
      expect((await app.inject({ method: 'GET', url: '/api/movies/continue-watching' })).json()).toMatchObject({ error: 'PROFILE_REQUIRED' });

      expect((await app.inject({ method: 'PUT', url: '/api/movies/1/progress', headers: a(deviceA), payload: progress })).statusCode).toBe(200);
      const resumed = (await app.inject({ method: 'GET', url: '/api/movies/continue-watching', headers: a(deviceB) })).json();
      expect(resumed).toMatchObject([{ id: 1, resumePositionMs: 1_800_000 }]);
      expect((await app.inject({ method: 'GET', url: '/api/movies/1', headers: a(deviceB) })).json().resumePositionMs).toBe(1_800_000);
      expect((await app.inject({ method: 'GET', url: '/api/movies/continue-watching', headers: b })).json()).toEqual([]);
      expect((await app.inject({ method: 'GET', url: '/api/movies/1', headers: b })).json().resumePositionMs).toBeNull();

      await app.inject({ method: 'PUT', url: '/api/movies/1/watch-state', headers: b, payload: { watched: true } });
      expect((await app.inject({ method: 'GET', url: '/api/movies/1', headers: b })).json().watched).toBe(true);
      expect((await app.inject({ method: 'GET', url: '/api/movies/1', headers: a() })).json().watched).toBe(false);
      expect((await app.inject({ method: 'GET', url: '/api/movies?watched=true', headers: b })).json().total).toBe(1);
      expect((await app.inject({ method: 'GET', url: '/api/movies?watched=true', headers: a() })).json().total).toBe(0);

      expect((await app.inject({ method: 'POST', url: '/api/movies/2/complete', headers: b })).json().watched).toBe(true);
      expect((await app.inject({ method: 'GET', url: '/api/movies/continue-watching', headers: b })).json()).toMatchObject([{ id: 3, nextUp: 'episode', resumePositionMs: 0 }]);
      expect((await app.inject({ method: 'GET', url: '/api/movies/continue-watching', headers: a() })).json().map((item: { id: number }) => item.id)).toEqual([1]);
      expect((await app.inject({ method: 'GET', url: '/api/movies/2/next', headers: a() })).json()).toMatchObject({ id: 3, watched: false, resumePositionMs: null });
      expect((await app.inject({ method: 'GET', url: '/api/movies/2/next', headers: b })).json()).toMatchObject({ id: 3, resumePositionMs: 0 });

      expect(db.prepare('SELECT device_id FROM playback_progress WHERE movie_id = 1').get()).toEqual({ device_id: deviceA });
    } finally { await app.close(); db.close(); }
  });

  it('works without x-device-id via the single PIN-less profile, and still refuses a malformed one', async () => {
    const { app, db } = fixture();
    try {
      expect((await app.inject({ method: 'PUT', url: '/api/movies/1/progress', payload: progress })).statusCode).toBe(200);
      expect((await app.inject({ method: 'GET', url: '/api/movies/continue-watching' })).json()).toMatchObject([{ id: 1 }]);
      expect((await app.inject({ method: 'PUT', url: '/api/movies/1/watch-state', payload: { watched: true } })).json().watched).toBe(true);
      for (const [method, url] of [['GET', '/api/movies/continue-watching'], ['PUT', '/api/movies/1/watch-state'], ['POST', '/api/movies/1/plays']] as const) {
        const response = await app.inject({ method, url, headers: { 'x-device-id': 'nope' }, ...(method === 'GET' ? {} : { payload: { watched: true, method: 'm3u' } }) });
        expect(response.statusCode).toBe(400);
        expect(response.json().error).toBe('X-Device-Id must be a UUID');
      }
      expect(db.prepare('SELECT device_id, watched FROM movie_watch_state').all()).toEqual([{ device_id: null, watched: 1 }]);
    } finally { await app.close(); db.close(); }
  });

  it('keeps hides per profile, ignores duplicate imports and validates keys', async () => {
    const { app, db } = fixture();
    try {
      const { a, b } = await twoProfiles(app);
      expect((await app.inject({ method: 'POST', url: '/api/hides', headers: a(), payload: { key: 'm:1' } })).json()).toEqual({ keys: ['m:1'] });
      expect((await app.inject({ method: 'GET', url: '/api/hides', headers: b })).json()).toEqual({ keys: [] });
      const imported = (await app.inject({ method: 'POST', url: '/api/hides/import', headers: a(deviceB), payload: { keys: ['m:1', 'tmdb:tv:1', 'tmdb:tv:1'] } })).json();
      expect([...imported.keys].sort()).toEqual(['m:1', 'tmdb:tv:1']);
      expect((await app.inject({ method: 'DELETE', url: '/api/hides', headers: a(), payload: { key: 'm:1' } })).json()).toEqual({ keys: ['tmdb:tv:1'] });
      expect((await app.inject({ method: 'GET', url: '/api/hides', headers: a() })).json()).toEqual({ keys: ['tmdb:tv:1'] });
      expect((await app.inject({ method: 'POST', url: '/api/hides', headers: a(), payload: { key: '' } })).statusCode).toBe(400);
      expect((await app.inject({ method: 'POST', url: '/api/hides', headers: a(), payload: { key: 'x'.repeat(201) } })).statusCode).toBe(400);
      expect((await app.inject({ method: 'POST', url: '/api/hides/import', headers: a(), payload: { keys: ['ok', 7] } })).statusCode).toBe(400);
      expect((await app.inject({ method: 'GET', url: '/api/hides' })).statusCode).toBe(409);
    } finally { await app.close(); db.close(); }
  });

  it('records announced plays and finishes them when progress is saved', async () => {
    const { app, db } = fixture();
    try {
      const { a, b } = await twoProfiles(app);
      const play = await app.inject({ method: 'POST', url: '/api/movies/1/plays', headers: a(), payload: { method: 'm3u', positionMs: 5_000 } });
      expect(play.statusCode).toBe(200);
      const { playId } = play.json() as { playId: number };
      expect(playId).toBeGreaterThan(0);
      expect((await app.inject({ method: 'POST', url: '/api/movies/999/plays', headers: a(), payload: { method: 'm3u' } })).statusCode).toBe(404);
      expect((await app.inject({ method: 'POST', url: '/api/movies/1/plays', headers: a(), payload: { method: 'vlc' } })).statusCode).toBe(400);
      expect((await app.inject({ method: 'POST', url: '/api/movies/1/plays', payload: { method: 'm3u' } })).statusCode).toBe(409);

      await app.inject({ method: 'PUT', url: '/api/movies/1/progress', headers: b, payload: progress });
      await app.inject({ method: 'PUT', url: '/api/movies/1/progress', headers: a(deviceB), payload: progress });
      const rows = db.prepare('SELECT id, method, device_id, start_position_ms AS start, end_position_ms AS end, ended_at IS NOT NULL AS ended, completed FROM playback_history ORDER BY id').all();
      expect(rows).toEqual([
        { id: playId, method: 'm3u', device_id: deviceA, start: 5_000, end: 1_800_000, ended: 1, completed: 0 },
        { id: playId + 1, method: 'android_app', device_id: deviceB, start: 0, end: 1_800_000, ended: 1, completed: 0 }
      ]);
    } finally { await app.close(); db.close(); }
  });
});
