import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { authStatusSchema, movieFilterOptionsSchema, movieListItemSchema, movieListPageSchema, movieSchema, pinLoginResultSchema, playbackProgressResultSchema, playbackSourceSchema, scanRunSchema, serverInfoSchema, shelfDetailSchema, shelfSummarySchema } from '@ottlib/shared';
import { buildApp } from '../app.js';
import { createDatabase } from '../db/db.js';
import { MediaTrackRepository } from '../repositories/mediaTrackRepository.js';
import { MovieRepository } from '../repositories/movieRepository.js';
import { ScanRunRepository } from '../repositories/scanRunRepository.js';

// Endpoints used by the native (Android TV) client. Responses are written to /contract/fixtures, which the
// Kotlin tests decode strictly — a shape change here fails there. Refresh fixtures with `npx vitest run -u`.
const fixturesPath = '../../../../contract/fixtures';
const device = '3f1c2a52-8a3b-4f0e-9a51-2d6f0f5d9c11';
const headers = { 'x-device-id': device };
const directories: string[] = [];

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'ottlib-native-client-')); directories.push(directory);
  const media = join(directory, 'media'); const db = createDatabase(join(directory, 'data'));
  db.prepare('INSERT INTO folders (path) VALUES (?)').run(media);
  const moviePath = join(media, 'Arrival.2016.2160p.mkv'); const otherPath = join(media, 'Home.Video.mp4');
  mkdirSync(media, { recursive: true });
  writeFileSync(moviePath, 'x'.repeat(1_000)); writeFileSync(otherPath, 'y'.repeat(10));
  writeFileSync(join(media, 'Arrival.2016.eng.srt'), '1\n00:00:01,000 --> 00:00:02,000\nHello\n');
  writeFileSync(join(media, 'Arrival.2016.hin.sub'), 'unsupported for side-loading');
  const movies = new MovieRepository(db);
  movies.upsertScanned({ folderId: 1, path: moviePath, filename: 'Arrival.2016.2160p.mkv', title: 'Arrival', year: 2016, size: 1_000, mtimeMs: 1, seenAt: '2026-01-01T00:00:00.000Z' });
  movies.upsertScanned({ folderId: 1, path: otherPath, filename: 'Home.Video.mp4', title: 'Home Video', year: null, size: 10, mtimeMs: 1, seenAt: '2026-01-01T00:00:00.000Z' });
  movies.applyMetadata(1, { source: 'tmdb', providerId: '329865', mediaType: 'movie', title: 'Arrival', year: 2016, overview: 'A linguist is recruited to talk to visitors.', posterFile: 'arrival.jpg', backdropFile: 'arrival-backdrop.jpg', genres: ['Drama', 'Science Fiction'], cast: ['Amy Adams', 'Jeremy Renner'], rating: 7.6, runtime: 116, imdbId: 'tt2543164' });
  movies.markUnmatched(2);
  movies.applyMediaInfo(1, { container: 'MKV', durationMs: 6_960_000, width: 3840, height: 2160, videoCodec: 'HEVC', videoProfile: 'Main 10', videoBitRate: 40_000_000, hdrFormat: 'HDR10' });
  new MediaTrackRepository(db).replaceForMovie(1, [
    { type: 'audio', source: 'embedded', order: 1, language: 'eng', title: 'Surround 5.1', codec: 'E-AC-3', channels: 6, channelLayout: '5.1(side)', isDefault: true, isForced: false, isHearingImpaired: false },
    { type: 'subtitle', source: 'embedded', order: 2, language: 'eng', title: null, codec: 'PGS', channels: null, channelLayout: null, isDefault: false, isForced: false, isHearingImpaired: false }
  ]);
  return { app: buildApp(db, join(directory, 'data'), 8081), db, media };
}

/** Replace values that vary per run (timestamps, temp paths, host details) so fixtures are stable. */
function stable(value: unknown, media: string): unknown {
  return JSON.parse(JSON.stringify(value, (key, field) => {
    if (['addedAt', 'createdAt', 'updatedAt'].includes(key)) return '2026-01-01T00:00:00.000Z';
    if (key === 'token' && typeof field === 'string') return 'session-token';
    if (['startedAt', 'finishedAt'].includes(key) && typeof field === 'string') return '2026-01-01 00:00:00';
    if (key === 'filePath' && typeof field === 'string') return field.replace(media, 'D:\\Movies').replaceAll('/', '\\');
    return field;
  }));
}

async function snapshot(name: string, value: unknown, media: string): Promise<void> {
  await expect(`${JSON.stringify(stable(value, media), null, 2)}\n`).toMatchFileSnapshot(`${fixturesPath}/${name}.json`);
}

afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })));

describe('native client endpoints', () => {
  it('describe the playback source, including side-loadable subtitles', async () => {
    const { app, db, media } = fixture();
    try {
      const response = await app.inject({ method: 'GET', url: '/api/movies/1/playback', headers });
      expect(response.statusCode).toBe(200);
      const source = playbackSourceSchema.parse(response.json());
      expect(source).toMatchObject({ kind: 'direct', streamUrl: '/api/stream/1', mimeType: 'video/x-matroska', durationMs: 6_960_000, resumePositionMs: null });
      expect(source.subtitles).toHaveLength(1);
      expect(source.subtitles[0]).toMatchObject({ language: 'eng', codec: 'SRT' });
      await snapshot('playback-source', source, media);

      const subtitle = await app.inject({ method: 'GET', url: source.subtitles[0].url });
      expect(subtitle.statusCode).toBe(200);
      expect(subtitle.headers['content-type']).toBe('application/x-subrip');
      expect(subtitle.body).toContain('Hello');
      expect((await app.inject({ method: 'GET', url: '/api/movies/1/subtitles/99999' })).statusCode).toBe(404);
      expect((await app.inject({ method: 'GET', url: '/api/movies/999/playback' })).statusCode).toBe(404);
    } finally { await app.close(); db.close(); }
  });

  it('records progress, lists continue watching, and clears it when marked watched', async () => {
    const { app, db, media } = fixture();
    try {
      expect((await app.inject({ method: 'PUT', url: '/api/movies/1/progress', payload: { positionMs: 1_830_000, durationMs: 6_960_000 } })).statusCode).toBe(400);
      const saved = await app.inject({ method: 'PUT', url: '/api/movies/1/progress', headers, payload: { positionMs: 1_830_000, durationMs: 6_960_000 } });
      expect(saved.statusCode).toBe(200);
      await snapshot('progress-result', playbackProgressResultSchema.parse(saved.json()), media);

      const detail = movieSchema.parse((await app.inject({ method: 'GET', url: '/api/movies/1', headers })).json());
      expect(detail.resumePositionMs).toBe(1_830_000);
      const playback = playbackSourceSchema.parse((await app.inject({ method: 'GET', url: '/api/movies/1/playback', headers })).json());
      expect(playback.resumePositionMs).toBe(1_830_000);

      const continueWatching = (await app.inject({ method: 'GET', url: '/api/movies/continue-watching', headers })).json() as unknown[];
      expect(continueWatching.map((item) => movieListItemSchema.parse(item).id)).toEqual([1]);
      await snapshot('continue-watching', continueWatching, media);

      await app.inject({ method: 'PUT', url: '/api/movies/1/watch-state', headers, payload: { watched: true } });
      expect((await app.inject({ method: 'GET', url: '/api/movies/continue-watching', headers })).json()).toEqual([]);

      await app.inject({ method: 'PUT', url: '/api/movies/1/progress', headers, payload: { positionMs: 1_830_000, durationMs: 6_960_000 } });
      expect((await app.inject({ method: 'DELETE', url: '/api/movies/1/progress', headers })).statusCode).toBe(204);
      expect((await app.inject({ method: 'GET', url: '/api/movies/continue-watching', headers })).json()).toEqual([]);
    } finally { await app.close(); db.close(); }
  });

  it('serve browse responses in the shapes the native client decodes', async () => {
    const { app, db, media } = fixture();
    try {
      const info = serverInfoSchema.parse((await app.inject({ method: 'GET', url: '/api/server-info' })).json());
      expect(info.apiVersion).toBe(1);
      await snapshot('server-info', { ...info, name: 'Ottlib on HOST', version: '0.0.0', addresses: ['192.168.1.10'] }, media);

      await snapshot('movie-list-page', movieListPageSchema.parse((await app.inject({ method: 'GET', url: '/api/movies?limit=1', headers })).json()), media);
      await snapshot('movie', movieSchema.parse((await app.inject({ method: 'GET', url: '/api/movies/1', headers })).json()), media);
      await snapshot('movie-unmatched', movieSchema.parse((await app.inject({ method: 'GET', url: '/api/movies/2', headers })).json()), media);
      await snapshot('filter-options', movieFilterOptionsSchema.parse((await app.inject({ method: 'GET', url: '/api/movies/filter-options' })).json()), media);

      const shelf = (await app.inject({ method: 'POST', url: '/api/shelves', payload: { name: 'Sci-Fi', movieIds: [1] } })).json() as { id: number };
      await snapshot('shelf-summaries', shelfSummarySchema.array().parse((await app.inject({ method: 'GET', url: '/api/shelves' })).json()), media);
      await snapshot('shelf-detail', shelfDetailSchema.parse((await app.inject({ method: 'GET', url: `/api/shelves/${shelf.id}`, headers })).json()), media);
    } finally { await app.close(); db.close(); }
  });

  it('report the library scan the Sync button starts and follows', async () => {
    const { app, db, media } = fixture();
    try {
      // Nothing has scanned yet: the endpoint answers with a bare status instead of a run.
      const idle = (await app.inject({ method: 'GET', url: '/api/scan/status' })).json();
      expect(idle).toEqual({ status: 'idle' });
      await snapshot('scan-status-idle', idle, media);

      const runs = new ScanRunRepository(db);
      const run = runs.create('scan');
      runs.progress(run.id, 658, 120, 0);
      const running = scanRunSchema.parse((await app.inject({ method: 'GET', url: '/api/scan/status' })).json());
      expect(running).toMatchObject({ status: 'running', filesFound: 658, filesProcessed: 120, finishedAt: null });
      await snapshot('scan-status-running', running, media);

      runs.progress(run.id, 658, 658, 3);
      runs.finish(run.id, 'completed');
      const completed = scanRunSchema.parse((await app.inject({ method: 'GET', url: '/api/scan/status' })).json());
      expect(completed).toMatchObject({ status: 'completed', titlesAdded: 3, errorSummary: null });
      await snapshot('scan-status-completed', completed, media);
    } finally { await app.close(); db.close(); }
  });

  it('sign in with the access PIN and hand keyed stream links to players', async () => {
    const { app, db, media } = fixture();
    try {
      await app.inject({ method: 'PUT', url: '/api/auth/pin', payload: { newPin: '2468' } });
      expect(serverInfoSchema.parse((await app.inject({ method: 'GET', url: '/api/server-info' })).json()).authRequired).toBe(true);
      expect((await app.inject({ method: 'GET', url: '/api/movies/1', headers })).statusCode).toBe(401);
      const status = authStatusSchema.parse((await app.inject({ method: 'GET', url: '/api/auth/status' })).json());
      expect(status).toEqual({ pinEnabled: true, authenticated: false });
      await snapshot('auth-status', status, media);

      expect((await app.inject({ method: 'POST', url: '/api/auth/login', payload: { pin: '1111' } })).statusCode).toBe(401);
      const login = pinLoginResultSchema.parse((await app.inject({ method: 'POST', url: '/api/auth/login', payload: { pin: '2468' } })).json());
      await snapshot('pin-login-result', login, media);
      const authorized = { ...headers, authorization: `Bearer ${login.token}` };
      expect((await app.inject({ method: 'GET', url: '/api/movies/1', headers: authorized })).statusCode).toBe(200);

      const source = playbackSourceSchema.parse((await app.inject({ method: 'GET', url: '/api/movies/1/playback', headers: authorized })).json());
      expect(source.streamUrl).toMatch(/^\/api\/stream\/1\?key=[\w-]+$/);
      expect((await app.inject({ method: 'HEAD', url: source.streamUrl })).statusCode).toBe(200);
      expect((await app.inject({ method: 'GET', url: source.subtitles[0].url })).statusCode).toBe(200);
      expect((await app.inject({ method: 'HEAD', url: '/api/stream/1' })).statusCode).toBe(401);
      expect((await app.inject({ method: 'HEAD', url: source.streamUrl.replace('/stream/1', '/stream/2') })).statusCode).toBe(401);
    } finally { await app.close(); db.close(); }
  });
});
