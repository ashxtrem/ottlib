import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { playbackSourceSchema, type MediaTrack } from '@ottlib/shared';
import { buildApp } from '../app.js';
import { createDatabase } from '../db/db.js';
import { FfmpegLocator, type ExecFn } from '../providers/transcode/ffmpegLocator.js';
import { MediaTrackRepository } from '../repositories/mediaTrackRepository.js';
import { MovieRepository } from '../repositories/movieRepository.js';

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })));

const track = (order: number, type: MediaTrack['type'], codec: string, extra: Partial<MediaTrack> = {}): MediaTrack => ({
  type, source: 'embedded', order, language: 'eng', title: null, codec, channels: null, channelLayout: null, isDefault: false, isForced: false, isHearingImpaired: false, ...extra
});

/** ffmpeg that holds every extraction until release() and then writes a tiny WebVTT file. */
function fakeFfmpeg(missing = false) {
  let release!: () => void; const gate = new Promise<void>((resolve) => { release = resolve; });
  let extractions = 0;
  const exec: ExecFn = async (_command, args) => {
    if (missing) throw new Error('spawn ffmpeg ENOENT');
    if (!args.includes('-i')) return { code: 0, stdout: args.includes('-version') ? 'ffmpeg version test' : '', stderr: '' };
    extractions++; await gate; writeFileSync(args[args.length - 1], 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello\n');
    return { code: 0, stdout: '', stderr: '' };
  };
  return { locator: new FfmpegLocator(exec, 'ffmpeg'), release, extractions: () => extractions };
}

function fixture(ffmpeg: FfmpegLocator) {
  const directory = mkdtempSync(join(tmpdir(), 'ottlib-embedded-routes-')); directories.push(directory);
  const media = join(directory, 'media'); mkdirSync(media, { recursive: true });
  const db = createDatabase(join(directory, 'data'));
  db.prepare('INSERT INTO folders (path) VALUES (?)').run(media);
  const path = join(media, 'Film.mkv'); writeFileSync(path, 'x'.repeat(100));
  const movies = new MovieRepository(db);
  movies.upsertScanned({ folderId: 1, path, filename: 'Film.mkv', title: 'Film', year: 2020, size: 100, mtimeMs: 1, seenAt: '2026-01-01T00:00:00.000Z' });
  movies.applyMediaInfo(1, { container: 'MP4', durationMs: 60_000, width: 1920, height: 1080, videoCodec: 'H.264', videoProfile: null, videoBitRate: null, hdrFormat: null });
  new MediaTrackRepository(db).replaceForMovie(1, [
    track(1, 'audio', 'AAC', { channels: 2, isDefault: true }), track(2, 'subtitle', 'SRT', { title: 'English', isForced: true }),
    track(3, 'subtitle', 'ASS', { language: 'fra', isHearingImpaired: true }), track(4, 'subtitle', 'PGS')
  ]);
  return { app: buildApp(db, join(directory, 'data'), 0, { ffmpeg, ffmpegAvailable: async () => false }), db };
}

const url = (order: number | string, query = '') => `/api/movies/1/subtitles/embedded/${order}.vtt${query}`;
const settle = () => new Promise((resolve) => setTimeout(resolve, 100));

describe('embedded subtitle route', () => {
  it('answers 202 with Retry-After while extracting (GET and HEAD share one run), then the WebVTT file', async () => {
    const ffmpeg = fakeFfmpeg(); const { app, db } = fixture(ffmpeg.locator);
    try {
      const first = await app.inject({ method: 'GET', url: url(2) });
      expect(first.statusCode).toBe(202);
      expect(first.headers['retry-after']).toBe('2');
      const head = await app.inject({ method: 'HEAD', url: url(2) });
      expect(head.statusCode).toBe(202);
      expect(head.headers['retry-after']).toBe('2');
      expect(head.body).toBe('');
      await settle();
      expect(ffmpeg.extractions()).toBe(1);

      ffmpeg.release(); await settle();
      const ready = await app.inject({ method: 'GET', url: url(2) });
      expect(ready.statusCode).toBe(200);
      expect(ready.headers['content-type']).toBe('text/vtt; charset=utf-8');
      expect(ready.body).toContain('Hello');
      const probed = await app.inject({ method: 'HEAD', url: url(2) });
      expect(probed.statusCode).toBe(200);
      expect(probed.headers['content-type']).toBe('text/vtt; charset=utf-8');
      expect(Number(probed.headers['content-length'])).toBe(ready.rawPayload.length);
      expect(probed.body).toBe('');
      expect(ffmpeg.extractions()).toBe(1);
    } finally { await app.close(); db.close(); }
  });

  it('answers 404 for an image track, an audio track, an unknown order and an unknown movie, and 503 without ffmpeg', async () => {
    const ffmpeg = fakeFfmpeg(); const { app, db } = fixture(ffmpeg.locator);
    try {
      for (const order of [1, 4, 9, 'x', -1]) {
        expect((await app.inject({ method: 'GET', url: url(order) })).statusCode, String(order)).toBe(404);
        expect((await app.inject({ method: 'HEAD', url: url(order) })).statusCode, String(order)).toBe(404);
      }
      expect((await app.inject({ method: 'GET', url: '/api/movies/99/subtitles/embedded/2.vtt' })).statusCode).toBe(404);
      expect(ffmpeg.extractions()).toBe(0);
    } finally { await app.close(); db.close(); }
    const none = fixture(fakeFfmpeg(true).locator);
    try {
      const response = await none.app.inject({ method: 'GET', url: url(2) });
      expect(response.statusCode).toBe(503);
      expect(response.json().error).toContain('ffmpeg');
    } finally { await none.app.close(); none.db.close(); }
  });

  it('needs a session or the stream key once an access PIN is set', async () => {
    const ffmpeg = fakeFfmpeg(); ffmpeg.release(); const { app, db } = fixture(ffmpeg.locator);
    try {
      const set = await app.inject({ method: 'PUT', url: '/api/auth/pin', payload: { newPin: '1357' } });
      const cookie = String(set.headers['set-cookie']).split(';')[0];
      expect((await app.inject({ method: 'GET', url: url(2) })).statusCode).toBe(401);
      expect((await app.inject({ method: 'HEAD', url: url(2, '?key=wrong') })).statusCode).toBe(401);
      const source = playbackSourceSchema.parse((await app.inject({ method: 'GET', url: '/api/movies/1/playback?video=h264', headers: { cookie } })).json());
      const embedded = source.subtitles.find((subtitle) => subtitle.codec === 'WEBVTT')!;
      expect(embedded.url).toMatch(/^\/api\/movies\/1\/subtitles\/embedded\/2\.vtt\?key=/);
      expect((await app.inject({ method: 'GET', url: embedded.url })).statusCode).toBe(202);
      await settle();
      expect((await app.inject({ method: 'GET', url: embedded.url })).statusCode).toBe(200);
      expect((await app.inject({ method: 'HEAD', url: embedded.url })).statusCode).toBe(200);
    } finally { await app.close(); db.close(); }
  });
});

describe('playback source with embedded subtitles', () => {
  it('lists the embedded text tracks and the image tracks for a capability request only', async () => {
    const { app, db } = fixture(fakeFfmpeg().locator);
    try {
      const capable = playbackSourceSchema.parse((await app.inject({ method: 'GET', url: '/api/movies/1/playback?video=h264' })).json());
      expect(capable.subtitles).toEqual([
        { url: '/api/movies/1/subtitles/embedded/2.vtt', language: 'eng', codec: 'WEBVTT', title: 'English', isForced: true, isHearingImpaired: false },
        { url: '/api/movies/1/subtitles/embedded/3.vtt', language: 'fra', codec: 'WEBVTT', title: null, isForced: false, isHearingImpaired: true }
      ]);
      expect(capable.burnInSubtitles).toEqual([{ order: 4, language: 'eng', title: null, codec: 'PGS', isForced: false }]);
      const bare = playbackSourceSchema.parse((await app.inject({ method: 'GET', url: '/api/movies/1/playback' })).json());
      expect(bare.subtitles).toEqual([]);
      expect(bare).not.toHaveProperty('burnInSubtitles');
    } finally { await app.close(); db.close(); }
  });
});
