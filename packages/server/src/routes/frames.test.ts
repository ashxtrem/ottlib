import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../db/db.js';
import type { FfmpegBinary } from '../providers/transcode/ffmpegLocator.js';
import { AccessPinRepository } from '../repositories/accessPinRepository.js';
import { AuthSessionRepository } from '../repositories/authSessionRepository.js';
import { MovieRepository } from '../repositories/movieRepository.js';
import { AccessPinService } from '../services/accessPinService.js';
import { fakeFrameSpawner, fakeJpeg } from '../services/frames/frameFixture.js';
import { FrameService } from '../services/frames/frameService.js';
import { PlaybackService } from '../services/playbackService.js';
import { registerAuthGuard } from './authGuard.js';
import { registerFrameRoutes } from './frames.js';

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })));

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'ottlib-frame-routes-')); directories.push(directory);
  const media = join(directory, 'media'); mkdirSync(media, { recursive: true });
  const db = createDatabase(join(directory, 'data'));
  db.prepare('INSERT INTO folders (path) VALUES (?)').run(media);
  const path = join(media, 'Film.mkv'); writeFileSync(path, 'x'.repeat(100));
  const movies = new MovieRepository(db);
  movies.upsertScanned({ folderId: 1, path, filename: 'Film.mkv', title: 'Film', year: 2020, size: 100, mtimeMs: 1, seenAt: '2026-01-01T00:00:00.000Z' });
  movies.applyMediaInfo(1, { container: 'MKV', durationMs: 60_000, width: 1920, height: 1080, videoCodec: 'H.264', videoProfile: null, videoBitRate: null, hdrFormat: null });
  const pins = new AccessPinService(new AccessPinRepository(db), new AuthSessionRepository(db));
  const playback = new PlaybackService(movies, (id) => pins.streamQuery(id));
  const { spawn, runs } = fakeFrameSpawner(true);
  const app = Fastify();
  registerAuthGuard(app, pins);
  registerFrameRoutes(app, new FrameService(playback, movies, async () => ({ path: 'ffmpeg' }) as FfmpegBinary, spawn));
  return { app, db, pins, playback, runs };
}

describe('frame route', () => {
  it('answers a JPEG with a private one-hour cache header and clamps t to the duration', async () => {
    const { app, db, runs } = fixture();
    try {
      const response = await app.inject({ method: 'GET', url: '/api/movies/1/frame?t=5000' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('image/jpeg');
      expect(response.headers['cache-control']).toBe('private, max-age=3600');
      expect(response.rawPayload.equals(fakeJpeg)).toBe(true);
      await app.inject({ method: 'GET', url: '/api/movies/1/frame?t=9999999' });
      await app.inject({ method: 'GET', url: '/api/movies/1/frame?t=-100' });
      expect(runs.map((run) => run.args[run.args.indexOf('-ss') + 1])).toEqual(['6.000', '60.000', '0.000']);
    } finally { await app.close(); db.close(); }
  });

  it('answers 400 for a missing or bad t and 404 for an unknown movie', async () => {
    const { app, db, runs } = fixture();
    try {
      for (const query of ['', '?t=', '?t=abc', '?t=1e3', '?t=1&t=2', '?key=']) expect((await app.inject({ method: 'GET', url: `/api/movies/1/frame${query}` })).statusCode, query).toBe(400);
      expect((await app.inject({ method: 'GET', url: '/api/movies/2/frame?t=0' })).statusCode).toBe(404);
      expect((await app.inject({ method: 'GET', url: '/api/movies/x/frame?t=0' })).statusCode).toBe(404);
      expect(runs).toHaveLength(0);
    } finally { await app.close(); db.close(); }
  });

  it('answers 204 to a request that a newer one from the same client replaced', async () => {
    const { app, db } = fixture();
    try {
      const older = app.inject({ method: 'GET', url: '/api/movies/1/frame?t=10000' });
      const newer = app.inject({ method: 'GET', url: '/api/movies/1/frame?t=20000' });
      const [first, second] = await Promise.all([older, newer]);
      expect([first.statusCode, second.statusCode]).toEqual([204, 200]);
    } finally { await app.close(); db.close(); }
  });

  it('loads with the playback source\'s framePreviewUrl plus &t= when an access PIN is set, and without one', async () => {
    const { app, db, pins, playback } = fixture();
    try {
      const open = await playback.source(1, undefined);
      expect(open.framePreviewUrl).toBe('/api/movies/1/frame?');
      expect((await app.inject({ method: 'GET', url: `${open.framePreviewUrl}&t=4000` })).statusCode).toBe(200);

      pins.setPin({ newPin: '1357' }, 'test');
      const keyed = (await playback.source(1, undefined)).framePreviewUrl;
      expect(keyed).toMatch(/^\/api\/movies\/1\/frame\?key=/);
      expect((await app.inject({ method: 'GET', url: `${keyed}&t=4000` })).statusCode).toBe(200);
      expect((await app.inject({ method: 'GET', url: '/api/movies/1/frame?&t=4000' })).statusCode).toBe(401);
      expect((await app.inject({ method: 'GET', url: '/api/movies/1/frame?key=wrong&t=4000' })).statusCode).toBe(401);
      expect((await app.inject({ method: 'GET', url: keyed.replace('/movies/1/', '/movies/2/') + '&t=4000' })).statusCode).toBe(401);
    } finally { await app.close(); db.close(); }
  });
});

