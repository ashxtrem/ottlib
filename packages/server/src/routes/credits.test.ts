import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PROFILE_SESSION_HEADER, autoSkipDefaultsSchema, playbackSourceSchema, profileSelectResultSchema, profileSummarySchema } from '@ottlib/shared';
import { buildApp } from '../app.js';
import { createDatabase } from '../db/db.js';
import { MovieRepository } from '../repositories/movieRepository.js';

const directories: string[] = [];
afterEach(() => { directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })); });

/** A movie (1) and two episodes of one show (2, 3), with two PIN-less profiles signed in on their own devices. */
async function setup() {
  const directory = mkdtempSync(join(tmpdir(), 'ottlib-credits-routes-')); directories.push(directory);
  const media = join(directory, 'media'); mkdirSync(media, { recursive: true });
  const db = createDatabase(join(directory, 'data'));
  db.prepare('INSERT INTO folders (path) VALUES (?)').run(media);
  const movies = new MovieRepository(db);
  for (const [index, name] of ['Movie.mkv', 'Show.E1.mkv', 'Show.E2.mkv'].entries()) {
    writeFileSync(join(media, name), 'x');
    movies.upsertScanned({ folderId: 1, path: join(media, name), filename: name, title: name, year: null, size: 1, mtimeMs: 1, seenAt: '2026-01-01T00:00:00.000Z' });
    const tv = index > 0;
    movies.applyMetadata(index + 1, { source: 'tmdb', providerId: tv ? '42' : '7', mediaType: tv ? 'tv' : 'movie', season: tv ? 1 : null, episode: tv ? index : null, title: name, year: null, overview: null, posterFile: null, backdropFile: null, genres: [], cast: [], rating: null, runtime: null, imdbId: null });
    movies.applyMediaInfo(index + 1, { container: 'MKV', durationMs: 2_700_000, width: 1920, height: 1080, videoCodec: 'H264', videoProfile: null, videoBitRate: null, hdrFormat: null });
  }
  const app = buildApp(db, join(directory, 'data'), 8081);
  const kids = profileSummarySchema.parse((await app.inject({ method: 'POST', url: '/api/profiles', payload: { name: 'Kids', color: '#17c964' } })).json());
  const session = async (profileId: number, device: string) => {
    const selected = profileSelectResultSchema.parse((await app.inject({ method: 'POST', url: `/api/profiles/${profileId}/select`, headers: { 'x-device-id': device }, payload: {} })).json());
    return { 'x-device-id': device, [PROFILE_SESSION_HEADER]: selected.token };
  };
  const home = await session(1, '3f1c2a52-8a3b-4f0e-9a51-2d6f0f5d9c11');
  const kid = await session(kids.id, '9d2f6a1e-1b7c-4c8e-8f3a-6e5d4c3b2a10');
  return { app, db, home, kid };
}

describe('credits routes', () => {
  it('keeps auto-skip defaults and overrides per profile, an episode override covering its series', async () => {
    const { app, db, home, kid } = await setup();
    try {
      const playback = async (id: number, headers: Record<string, string>) => playbackSourceSchema.parse((await app.inject({ method: 'GET', url: `/api/movies/${id}/playback`, headers })).json());
      expect(autoSkipDefaultsSchema.parse((await app.inject({ method: 'GET', url: '/api/profiles/current/auto-skip', headers: home })).json())).toEqual({ movie: false, tv: true });
      expect((await app.inject({ method: 'GET', url: '/api/profiles/current/auto-skip' })).statusCode).toBe(409);

      const saved = await app.inject({ method: 'PUT', url: '/api/profiles/current/auto-skip', headers: home, payload: { movie: true, tv: false } });
      expect(saved.json()).toEqual({ movie: true, tv: false });
      expect((await app.inject({ method: 'GET', url: '/api/profiles/current/auto-skip', headers: kid })).json()).toEqual({ movie: false, tv: true });
      expect((await playback(1, home)).autoSkipCredits).toBe(true);
      expect((await playback(1, kid)).autoSkipCredits).toBe(false);

      const override = await app.inject({ method: 'PUT', url: '/api/movies/2/auto-skip', headers: kid, payload: { enabled: false } });
      expect(override.json()).toEqual({ autoSkipCredits: false });
      expect((await playback(3, kid)).autoSkipCredits).toBe(false); // the whole series
      expect((await playback(3, home)).autoSkipCredits).toBe(false); // home's own default (tv off), untouched by kid
      await app.inject({ method: 'PUT', url: '/api/profiles/current/auto-skip', headers: home, payload: { movie: true, tv: true } });
      expect((await playback(3, home)).autoSkipCredits).toBe(true);
      expect((await app.inject({ method: 'PUT', url: '/api/movies/3/auto-skip', headers: kid, payload: { enabled: null } })).json()).toEqual({ autoSkipCredits: true });

      expect((await app.inject({ method: 'PUT', url: '/api/movies/999/auto-skip', headers: kid, payload: { enabled: true } })).statusCode).toBe(404);
      expect((await app.inject({ method: 'PUT', url: '/api/movies/1/auto-skip', headers: kid, payload: { enabled: 'yes' } })).statusCode).toBe(400);
      expect((await app.inject({ method: 'PUT', url: '/api/profiles/current/auto-skip', headers: kid, payload: { movie: true } })).statusCode).toBe(400);
    } finally { await app.close(); db.close(); }
  });

  it('sets and clears the shared credits mark', async () => {
    const { app, db, home, kid } = await setup();
    try {
      const marked = await app.inject({ method: 'PUT', url: '/api/movies/2/credits', headers: home, payload: { startMs: 2_600_000 } });
      expect(marked.json()).toEqual({ credits: { startMs: 2_600_000, source: 'mark' } });
      const kidView = playbackSourceSchema.parse((await app.inject({ method: 'GET', url: '/api/movies/2/playback', headers: kid })).json());
      expect(kidView.credits).toEqual({ startMs: 2_600_000, source: 'mark' });
      // The sibling learns the same credits length from the marked episode.
      expect(playbackSourceSchema.parse((await app.inject({ method: 'GET', url: '/api/movies/3/playback', headers: kid })).json()).credits).toEqual({ startMs: 2_600_000, source: 'series' });
      expect((await app.inject({ method: 'PUT', url: '/api/movies/2/credits', headers: kid, payload: { startMs: null } })).json()).toEqual({ credits: null });
      expect((await app.inject({ method: 'PUT', url: '/api/movies/2/credits', headers: kid, payload: { startMs: -5 } })).statusCode).toBe(400);
      expect((await app.inject({ method: 'PUT', url: '/api/movies/999/credits', headers: kid, payload: { startMs: 5 } })).statusCode).toBe(404);
      expect((await app.inject({ method: 'PUT', url: '/api/movies/2/credits', payload: { startMs: 5 } })).statusCode).toBe(409);
    } finally { await app.close(); db.close(); }
  });

  it('builds a frame preview path that always takes `&t=`', async () => {
    const { app, db, home } = await setup();
    try {
      expect(playbackSourceSchema.parse((await app.inject({ method: 'GET', url: '/api/movies/1/playback', headers: home })).json()).framePreviewUrl).toBe('/api/movies/1/frame?');
    } finally { await app.close(); db.close(); }
  });
});
