import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { MediaTrack } from '@ottlib/shared';
import { createDatabase } from '../db/db.js';
import { FfmpegLocator, type FfmpegBinary } from '../providers/transcode/ffmpegLocator.js';
import { MediaTrackRepository } from '../repositories/mediaTrackRepository.js';
import { MovieRepository } from '../repositories/movieRepository.js';
import { EmbeddedSubtitleError, EmbeddedSubtitleService, type EmbeddedVtt } from './embeddedSubtitleService.js';

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })));

const track = (order: number, codec: string, type: MediaTrack['type'] = 'subtitle'): MediaTrack => ({
  type, source: 'embedded', order, language: 'eng', title: null, codec, channels: null, channelLayout: null, isDefault: false, isForced: false, isHearingImpaired: false
});

function fixture(tracks: MediaTrack[], locate: () => Promise<FfmpegBinary | null>, now?: () => number) {
  const directory = mkdtempSync(join(tmpdir(), 'ottlib-embedded-subs-')); directories.push(directory);
  const media = join(directory, 'media'); mkdirSync(media, { recursive: true });
  const db = createDatabase(join(directory, 'data'));
  db.prepare('INSERT INTO folders (path) VALUES (?)').run(media);
  const path = join(media, 'Film.mkv'); writeFileSync(path, 'not really a video');
  const movies = new MovieRepository(db);
  movies.upsertScanned({ folderId: 1, path, filename: 'Film.mkv', title: 'Film', year: 2020, size: 18, mtimeMs: 1, seenAt: '2026-01-01T00:00:00.000Z' });
  const repository = new MediaTrackRepository(db); repository.replaceForMovie(1, tracks);
  const service = new EmbeddedSubtitleService(repository, locate, join(directory, 'data'), now);
  return { service, movie: movies.playbackMovie(1)!, path, directory, cacheDir: join(directory, 'data', 'subtitles', 'embedded'), db };
}

/** A fake ffmpeg whose run() writes `output` to its last argument once `release()` is called. */
function gatedFfmpeg(output = 'WEBVTT\n\n') {
  let release!: () => void; const gate = new Promise<void>((resolve) => { release = resolve; });
  const calls: string[][] = [];
  const binary: FfmpegBinary = {
    path: 'ffmpeg', version: 'test', encoders: new Set(), filters: new Set(),
    run: async (args) => { calls.push(args); await gate; writeFileSync(args[args.length - 1], output); return { code: 0, stdout: '', stderr: '' }; }
  };
  return { binary, calls, release };
}

async function untilReady(service: EmbeddedSubtitleService, movie: ReturnType<typeof fixture>['movie'], order: number): Promise<EmbeddedVtt> {
  for (let attempt = 0; attempt < 400; attempt++) {
    const result = await service.vtt(movie, order);
    if (result.state === 'ready') return result;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('extraction did not finish');
}

describe('EmbeddedSubtitleService', () => {
  it('lists only the embedded text tracks and refuses any other order', async () => {
    const ffmpeg = gatedFfmpeg();
    const { service, movie, db } = fixture([track(1, 'AAC', 'audio'), track(2, 'SRT'), track(3, 'ASS'), track(4, 'MOV_TEXT'), track(5, 'PGS')], async () => ffmpeg.binary);
    try {
      expect(service.textTracks(1).map((item) => item.order)).toEqual([2, 3, 4]);
      for (const order of [1, 5, 9]) await expect(service.vtt(movie, order)).rejects.toMatchObject({ status: 404 });
      expect(ffmpeg.calls).toHaveLength(0);
    } finally { db.close(); }
  });

  it('answers extracting while ffmpeg runs, starts one extraction per track, then serves the cached file', async () => {
    const ffmpeg = gatedFfmpeg('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello\n');
    const { service, movie, cacheDir, db } = fixture([track(2, 'SRT')], async () => ffmpeg.binary);
    try {
      expect(await service.vtt(movie, 2)).toEqual({ state: 'extracting' });
      expect(await service.vtt(movie, 2)).toEqual({ state: 'extracting' });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(await service.vtt(movie, 2)).toEqual({ state: 'extracting' });
      expect(ffmpeg.calls).toHaveLength(1);
      expect(ffmpeg.calls[0].slice(ffmpeg.calls[0].indexOf('-map'), ffmpeg.calls[0].indexOf('-map') + 4)).toEqual(['-map', '0:2', '-f', 'webvtt']);
      ffmpeg.release();
      const ready = await untilReady(service, movie, 2);
      expect(ready).toMatchObject({ state: 'ready', path: join(cacheDir, '1-2.vtt') });
      expect(readFileSync(join(cacheDir, '1-2.vtt'), 'utf8')).toContain('Hello');
      expect(readdirSync(cacheDir)).toEqual(['1-2.vtt']);
      expect((await service.vtt(movie, 2)).state).toBe('ready');
      expect(ffmpeg.calls).toHaveLength(1);
    } finally { db.close(); }
  });

  it('extracts again when the movie file is newer than the cached VTT', async () => {
    const ffmpeg = gatedFfmpeg(); ffmpeg.release();
    const { service, movie, path, cacheDir, db } = fixture([track(2, 'SRT')], async () => ffmpeg.binary);
    try {
      await untilReady(service, movie, 2);
      const hourAgo = new Date(Date.now() - 3_600_000); const halfHourAgo = new Date(Date.now() - 1_800_000);
      utimesSync(join(cacheDir, '1-2.vtt'), hourAgo, hourAgo); utimesSync(path, halfHourAgo, halfHourAgo);
      expect((await service.vtt(movie, 2)).state).toBe('extracting');
      await untilReady(service, movie, 2);
      expect(ffmpeg.calls).toHaveLength(2);
    } finally { db.close(); }
  });

  it('reports a clear error without ffmpeg, and remembers a failed extraction briefly', async () => {
    const none = fixture([track(2, 'SRT')], async () => null);
    try { await expect(none.service.vtt(none.movie, 2)).rejects.toMatchObject({ status: 503, message: expect.stringContaining('ffmpeg') }); } finally { none.db.close(); }

    let clock = 1_000; let runs = 0;
    const failing: FfmpegBinary = { path: 'ffmpeg', version: 'test', encoders: new Set(), filters: new Set(), run: async () => { runs++; return { code: 1, stdout: '', stderr: 'boom\nStream map matches no streams.\n' }; } };
    const broken = fixture([track(2, 'SRT')], async () => failing, () => clock);
    try {
      expect((await broken.service.vtt(broken.movie, 2)).state).toBe('extracting');
      await new Promise((resolve) => setTimeout(resolve, 50));
      const error = await broken.service.vtt(broken.movie, 2).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(EmbeddedSubtitleError);
      expect(error).toMatchObject({ status: 422, message: expect.stringContaining('Stream map matches no streams') });
      expect(runs).toBe(1);
      clock += 61_000;
      expect((await broken.service.vtt(broken.movie, 2)).state).toBe('extracting');
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(runs).toBe(2);
    } finally { broken.db.close(); }
  });
});

const ffmpegBinary = await new FfmpegLocator().locate();
describe.skipIf(!ffmpegBinary)('EmbeddedSubtitleService with real ffmpeg', () => {
  it('extracts an SRT track of an MKV to WebVTT and serves the second request from the cache', async () => {
    const real = ffmpegBinary!;
    const { service, movie, path, directory, cacheDir, db } = fixture([track(1, 'SRT')], async () => real);
    try {
      const srt = join(directory, 'subs.srt'); writeFileSync(srt, '1\n00:00:00,500 --> 00:00:01,500\nHello <i>there</i>\n\n2\n00:00:02,000 --> 00:00:03,000\nSecond line\n');
      const made = spawnSync(real.path, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=64x64:d=4:r=10', '-i', srt, '-map', '0:v', '-map', '1:0', '-c:v', 'mpeg4', '-c:s', 'srt', path]);
      expect(made.status, String(made.stderr)).toBe(0);
      const started = Date.now();
      const first = await service.vtt(movie, 1);
      expect(first.state).toBe('extracting');
      const ready = await untilReady(service, movie, 1);
      console.log(`embedded subtitle extraction took ${Date.now() - started} ms`);
      const text = readFileSync(join(cacheDir, '1-1.vtt'), 'utf8');
      expect(text.startsWith('WEBVTT')).toBe(true);
      expect(text).toContain('00:00.500 --> 00:01.500');
      expect(text).toContain('Second line');
      expect(ready).toMatchObject({ state: 'ready', path: join(cacheDir, '1-1.vtt') });
      const cachedAt = readdirSync(cacheDir);
      expect((await service.vtt(movie, 1)).state).toBe('ready');
      expect(readdirSync(cacheDir)).toEqual(cachedAt);
    } finally { db.close(); }
  }, 30_000);
});
