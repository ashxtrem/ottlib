import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { transcodeEncodersSchema } from '@ottlib/shared';
import { buildApp } from '../app.js';
import { createDatabase } from '../db/db.js';
import { AccessPinRepository } from '../repositories/accessPinRepository.js';
import { AuthSessionRepository } from '../repositories/authSessionRepository.js';
import { EncoderRegistry } from '../providers/transcode/encoderRegistry.js';
import { FfmpegLocator, type ExecFn, type FfmpegBinary } from '../providers/transcode/ffmpegLocator.js';
import { x264Encoder } from '../providers/transcode/x264Encoder.js';
import { AccessPinService } from '../services/accessPinService.js';
import { fakeSpawner, fragment, initSegment } from '../services/hls/fmp4Fixture.js';
import { TranscodeSessionService } from '../services/hls/transcodeSessionService.js';

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })));

const binary: FfmpegBinary = { path: 'ffmpeg', version: 'ffmpeg version test', encoders: new Set(['libx264']), filters: new Set(), run: async () => ({ code: 0, stdout: '', stderr: '' }) };
const cookieFrom = (setCookie: string | string[] | undefined) => String(Array.isArray(setCookie) ? setCookie[0] : setCookie).split(';')[0];

function fixture(ffmpeg?: FfmpegLocator) {
  const directory = mkdtempSync(join(tmpdir(), 'ottlib-hls-routes-')); directories.push(directory);
  mkdirSync(join(directory, 'posters'), { recursive: true });
  const db = createDatabase(directory);
  const pins = new AccessPinService(new AccessPinRepository(db), new AuthSessionRepository(db));
  const fake = fakeSpawner();
  const hlsSessions = new TranscodeSessionService({
    locate: async () => binary, encoders: (found) => new EncoderRegistry(found, [{ ...x264Encoder, probe: async () => true }]), encoderSetting: () => 'auto',
    streamQuery: (id) => pins.streamQuery(id), spawn: fake.spawn, root: join(directory, 'hls'),
  });
  const app = buildApp(db, directory, 0, { hlsSessions, ...(ffmpeg ? { ffmpeg } : {}) });
  const open = async () => hlsSessions.open({
    movie: { id: 1, path: '/films/Arrival.mkv', folderPath: '/films', filename: 'Arrival.mkv', missing: false },
    mediaInfo: { container: 'MKV', durationMs: 10_000, width: 1920, height: 1080, videoCodec: 'H.264', videoProfile: null, videoBitRate: null, hdrFormat: null },
    decision: { mode: 'remux', audioOrder: null, audioCopy: true, burnSubtitleOrder: null, toneMap: false, reasons: ['container'] },
    keyframesMs: [0, 4000, 8000],
  });
  return { app, db, pins, open, runs: fake.runs };
}

describe('HLS routes', () => {
  it('serves the playlist, init and segments of a session; 404 for an unknown session or another movie id', async () => {
    const { app, db, open, runs } = fixture();
    try {
      const handle = await open(); const base = handle.sessionUrl;
      const playlist = await app.inject({ method: 'GET', url: `${base}/main.m3u8` });
      expect(playlist.statusCode).toBe(200);
      expect(playlist.headers['content-type']).toBe('application/vnd.apple.mpegurl');
      expect(playlist.body).toContain('seg-2.m4s');
      const segment = app.inject({ method: 'GET', url: `${base}/seg-0.m4s` });
      runs[0].produce([0]);
      const served = await segment;
      expect(served.statusCode).toBe(200);
      expect(served.headers['content-type']).toBe('video/mp4');
      expect(served.headers['cache-control']).toBe('no-store');
      expect(served.rawPayload.equals(fragment(0))).toBe(true);
      expect((await app.inject({ method: 'GET', url: `${base}/init.mp4` })).rawPayload.equals(initSegment())).toBe(true);
      expect((await app.inject({ method: 'GET', url: `${base}/seg-9.m4s` })).statusCode).toBe(404);
      expect((await app.inject({ method: 'GET', url: `${base.replace('/hls/1/', '/hls/2/')}/main.m3u8` })).statusCode).toBe(404);
      expect((await app.inject({ method: 'GET', url: '/api/hls/1/nope/main.m3u8' })).statusCode).toBe(404);
      expect((await app.inject({ method: 'DELETE', url: base })).statusCode).toBe(204);
      expect((await app.inject({ method: 'GET', url: `${base}/main.m3u8` })).statusCode).toBe(404);
    } finally { await app.close(); db.close(); }
  });

  it('needs a session or the movie\'s stream key once an access PIN is set', async () => {
    const { app, db, pins, open, runs } = fixture();
    try {
      const set = await app.inject({ method: 'PUT', url: '/api/auth/pin', payload: { newPin: '1357' } });
      const cookie = cookieFrom(set.headers['set-cookie']);
      const handle = await open(); const base = handle.sessionUrl; const query = pins.streamQuery(1);
      expect(handle.playlistUrl).toBe(`${base}/main.m3u8${query}`);
      for (const path of ['main.m3u8', 'init.mp4', 'seg-0.m4s']) {
        expect((await app.inject({ method: 'GET', url: `${base}/${path}` })).statusCode, path).toBe(401);
        expect((await app.inject({ method: 'GET', url: `${base}/${path}?key=wrong` })).statusCode, path).toBe(401);
      }
      const playlist = await app.inject({ method: 'GET', url: `${base}/main.m3u8${query}` });
      expect(playlist.statusCode).toBe(200);
      expect(playlist.body).toContain(`seg-0.m4s${query}`);
      const segment = app.inject({ method: 'GET', url: `${base}/seg-0.m4s${query}` });
      runs[0].produce([0]);
      expect((await segment).statusCode).toBe(200);
      expect((await app.inject({ method: 'GET', url: `${base}/init.mp4${query}` })).statusCode).toBe(200);
      expect((await app.inject({ method: 'DELETE', url: `${base}${query}` })).statusCode).toBe(401);
      expect((await app.inject({ method: 'GET', url: '/api/transcode/encoders' })).statusCode).toBe(401);
      expect((await app.inject({ method: 'DELETE', url: base, headers: { cookie } })).statusCode).toBe(204);
    } finally { await app.close(); db.close(); }
  });

  it('lists the encoders that work, the active one and the ffmpeg version', async () => {
    const exec: ExecFn = async (_command, args) => {
      if (args.includes('-version')) return { code: 0, stdout: 'ffmpeg version 7.1-test\nbuilt with gcc', stderr: '' };
      if (args.includes('-encoders')) return { code: 0, stdout: ' ------\n V....D libx264              libx264 H.264\n', stderr: '' };
      if (args.includes('-filters')) return { code: 0, stdout: '', stderr: '' };
      return { code: 0, stdout: '', stderr: '' };
    };
    const { app, db } = fixture(new FfmpegLocator(exec, 'ffmpeg'));
    try {
      const response = await app.inject({ method: 'GET', url: '/api/transcode/encoders' });
      expect(transcodeEncodersSchema.parse(response.json())).toEqual({ available: true, ffmpegVersion: 'ffmpeg version 7.1-test', encoders: ['x264'], active: 'x264' });
    } finally { await app.close(); db.close(); }
    const missing = fixture(new FfmpegLocator(async () => { throw new Error('spawn ffmpeg ENOENT'); }, 'ffmpeg'));
    try {
      expect((await missing.app.inject({ method: 'GET', url: '/api/transcode/encoders' })).json()).toEqual({ available: false, ffmpegVersion: null, encoders: [], active: null });
    } finally { await missing.app.close(); missing.db.close(); }
  });
});
