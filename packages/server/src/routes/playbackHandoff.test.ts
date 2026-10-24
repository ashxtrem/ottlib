import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDatabase } from '../db/db.js';
import { LocalLaunch, type Spawner } from '../providers/playback/localLaunch.js';
import { VlcLocator, type VlcProbes } from '../providers/playback/vlcLocator.js';
import { MovieRepository } from '../repositories/movieRepository.js';
import { PlaybackService } from '../services/playbackService.js';
import { StreamService } from '../services/streamService.js';
import { registerPlaybackRoutes } from './playback.js';
import { registerStreamRoutes } from './stream.js';

const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

function fixture(vlcPath: string | null) {
  const directory = mkdtempSync(join(tmpdir(), 'ottlib-handoff-')); directories.push(directory);
  const media = join(directory, 'media'); const db = createDatabase(join(directory, 'data'));
  db.prepare('INSERT INTO folders (path) VALUES (?)').run(media); mkdirSync(media, { recursive: true });
  const moviePath = join(media, 'My Movie (Cut) & Co.2016.mkv'); writeFileSync(moviePath, 'x'.repeat(100));
  const movies = new MovieRepository(db);
  movies.upsertScanned({ folderId: 1, path: moviePath, filename: 'My Movie (Cut) & Co.2016.mkv', title: 'My Movie', year: 2016, size: 100, mtimeMs: 1, seenAt: '2026-01-01T00:00:00.000Z' });
  const probes: VlcProbes = { platform: 'linux', env: {}, exists: () => false, lookup: () => vlcPath };
  const unref = vi.fn(); const spawn = vi.fn<Spawner>(() => ({ unref }));
  const playback = new PlaybackService(movies, () => '?key=abc', undefined, new LocalLaunch(new VlcLocator(probes), spawn));
  const app = Fastify(); registerPlaybackRoutes(app, playback); registerStreamRoutes(app, new StreamService(playback), playback);
  return { app, spawn, unref, moviePath, close: async () => { await app.close(); db.close(); } };
}

describe('POST /api/movies/:id/play-local', () => {
  it('opens the file with the OS default when no body is sent', async () => {
    const { app, spawn, moviePath, close } = fixture(null);
    const response = await app.inject({ method: 'POST', url: '/api/movies/1/play-local' });
    expect(response.statusCode).toBe(204);
    expect(spawn).toHaveBeenCalledTimes(1); expect(spawn.mock.calls[0]![1]).toContain(moviePath);
    expect(spawn.mock.calls[0]![0]).toMatch(/^(cmd\.exe|xdg-open)$/);
    await close();
  });

  it('spawns VLC detached with the start time and the file path', async () => {
    const { app, spawn, unref, moviePath, close } = fixture('/usr/bin/vlc');
    const response = await app.inject({ method: 'POST', url: '/api/movies/1/play-local', payload: { startSec: 90 } });
    expect(response.statusCode).toBe(204);
    expect(spawn).toHaveBeenCalledWith('/usr/bin/vlc', ['--start-time=90', moviePath], { detached: true, stdio: 'ignore' });
    expect(unref).toHaveBeenCalled();
    await close();
  });

  it('omits --start-time when there is nothing to resume', async () => {
    const { app, spawn, moviePath, close } = fixture('/usr/bin/vlc');
    await app.inject({ method: 'POST', url: '/api/movies/1/play-local', payload: { startSec: 0 } });
    await app.inject({ method: 'POST', url: '/api/movies/1/play-local', payload: {} });
    expect(spawn.mock.calls.map((call) => call[1])).toEqual([[moviePath], [moviePath]]);
    await close();
  });

  it('answers 409 VLC_NOT_FOUND and launches nothing when VLC is required but missing', async () => {
    const { app, spawn, close } = fixture(null);
    const response = await app.inject({ method: 'POST', url: '/api/movies/1/play-local', payload: { requireVlc: true, startSec: 5 } });
    expect(response.statusCode).toBe(409); expect(response.json()).toMatchObject({ error: 'VLC_NOT_FOUND', message: expect.any(String) });
    expect(spawn).not.toHaveBeenCalled();
    await close();
  });

  it('launches VLC when it is required and present', async () => {
    const { app, spawn, close } = fixture('/usr/bin/vlc');
    expect((await app.inject({ method: 'POST', url: '/api/movies/1/play-local', payload: { requireVlc: true } })).statusCode).toBe(204);
    expect(spawn).toHaveBeenCalledTimes(1);
    await close();
  });

  it('rejects a negative or fractional start', async () => {
    const { app, spawn, close } = fixture('/usr/bin/vlc');
    expect((await app.inject({ method: 'POST', url: '/api/movies/1/play-local', payload: { startSec: -1 } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/movies/1/play-local', payload: { startSec: 1.5 } })).statusCode).toBe(400);
    expect(spawn).not.toHaveBeenCalled();
    await close();
  });
});

describe('GET /api/stream/:id/playlist.m3u', () => {
  const url = 'http://tv.local/api/stream/1?key=abc';
  const get = async (query: string) => { const { app, close } = fixture(null); const response = await app.inject({ method: 'GET', url: `/api/stream/1/playlist.m3u${query}`, headers: { host: 'tv.local' } }); await close(); return response; };

  it('has no start line without ?start', async () => {
    const response = await get('');
    expect(response.statusCode).toBe(200); expect(response.body).toBe(`#EXTM3U\n${url}\n`);
  });

  it('puts the start time before the URL', async () => {
    const response = await get('?start=754');
    expect(response.body).toBe(`#EXTM3U\n#EXTVLCOPT:start-time=754\n${url}\n`);
  });

  it.each(['0', '-5', '1.5', 'abc', ''])('ignores start=%s', async (start) => {
    const response = await get(`?start=${start}`);
    expect(response.statusCode).toBe(200); expect(response.body).toBe(`#EXTM3U\n${url}\n`);
  });
});
