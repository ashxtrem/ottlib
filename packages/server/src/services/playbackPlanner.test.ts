import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDatabase } from '../db/db.js';
import { MediaTrackRepository } from '../repositories/mediaTrackRepository.js';
import { MovieRepository } from '../repositories/movieRepository.js';
import { PlaybackProgressRepository } from '../repositories/playbackProgressRepository.js';
import { ProfileRepository } from '../repositories/profileRepository.js';
import type { HlsSessionOpener } from './hls/sessionOpener.js';
import type { MediaInfoService } from './mediaInfoService.js';
import { PlaybackPlanner } from './playbackPlanner.js';

const directories: string[] = [];
afterEach(() => { directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })); });

const chrome = { containers: ['mp4'], video: ['h264'], audio: ['aac'], hdr: false };
const probed = { container: 'MKV', durationMs: 60_000, width: 1920, height: 1080, videoCodec: 'H.264', videoProfile: 'High', videoBitRate: 1, hdrFormat: null };
const audio = { type: 'audio' as const, source: 'embedded' as const, order: 1, language: 'eng', title: null, codec: 'AC-3', channels: 6, channelLayout: null, isDefault: true, isForced: false, isHearingImpaired: false };

function setup(options: { probe?: boolean; sessions?: boolean; keyframes?: number[] | null } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'ottlib-planner-')); directories.push(directory);
  const db = createDatabase(directory); const movies = new MovieRepository(db); const tracks = new MediaTrackRepository(db);
  db.prepare('INSERT INTO folders (path) VALUES (?)').run(directory);
  movies.upsertScanned({ folderId: 1, path: join(directory, 'a.mkv'), filename: 'a.mkv', title: 'A', year: null, size: 1, mtimeMs: 1, seenAt: '2026-01-01T00:00:00.000Z' });
  // Stands in for ffprobe: stores what a successful probe would.
  const refresh = vi.fn(async (id: number) => { if (options.probe === false) { movies.markMediaProbeFailed(id, 'no ffprobe'); return; } movies.applyMediaInfo(id, probed); tracks.replaceForMovie(id, [audio]); });
  const open = vi.fn<HlsSessionOpener['open']>().mockResolvedValue({ playlistUrl: '/api/hls/1/s/main.m3u8', sessionUrl: '/api/hls/1/s' });
  const keyframes = vi.fn(async () => options.keyframes === undefined ? [0, 2000, 4000] : options.keyframes);
  const planner = new PlaybackPlanner({ movies, tracks, mediaInfo: { refresh } as unknown as MediaInfoService, sessions: options.sessions === false ? undefined : { open }, ffmpegAvailable: async () => true, keyframes });
  return { planner, movies, refresh, open, keyframes, db, file: movies.playbackMovie(1)!, close: () => db.close() };
}

describe('PlaybackPlanner', () => {
  it('probes an unprobed file on demand, then remuxes it from its keyframes', async () => {
    const { planner, refresh, open, keyframes, file, movies, close } = setup();
    try {
      expect(movies.get(1, undefined)?.mediaInfo).toBeNull();
      const plan = await planner.plan(file, undefined, chrome, 'device-1');
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(keyframes).toHaveBeenCalledWith(file.path, 'MKV');
      expect(plan).toMatchObject({ mode: 'remux', reasons: ['container', 'audio-codec'], audioOrder: 1, hls: { playlistUrl: '/api/hls/1/s/main.m3u8', sessionUrl: '/api/hls/1/s' } });
      expect(plan.audioTracks).toEqual([{ order: 1, language: 'eng', title: null, codec: 'AC-3', channels: 6, isDefault: true }]);
      expect(open).toHaveBeenCalledWith(expect.objectContaining({ deviceId: 'device-1', keyframesMs: [0, 2000, 4000], decision: expect.objectContaining({ mode: 'remux', audioCopy: false }) }));
      await planner.plan(file, undefined, chrome);
      expect(refresh).toHaveBeenCalledTimes(1);
    } finally { close(); }
  });

  it("opens the session at the viewer's resume point when the request sends no start", async () => {
    const { planner, open, db, file, close } = setup();
    try {
      const owner = new ProfileRepository(db).getOwner()!.id;
      new PlaybackProgressRepository(db).set(1, owner, 'device-1', 1_800_000, 6_000_000);
      await planner.plan(file, owner, chrome);
      expect(open).toHaveBeenLastCalledWith(expect.objectContaining({ startMs: 1_800_000 }));
      await planner.plan(file, owner, { ...chrome, startMs: 60_000 });
      expect(open).toHaveBeenLastCalledWith(expect.objectContaining({ startMs: 60_000 }));
      await planner.plan(file, undefined, chrome);
      expect(open).toHaveBeenLastCalledWith(expect.objectContaining({ startMs: undefined }));
    } finally { close(); }
  });

  it('transcodes when the file has no usable keyframe index', async () => {
    const { planner, open, file, close } = setup({ keyframes: null });
    try {
      expect(await planner.plan(file, undefined, chrome)).toMatchObject({ mode: 'transcode', reasons: ['container', 'audio-codec', 'no-keyframes'] });
      expect(open).toHaveBeenCalledWith(expect.objectContaining({ keyframesMs: [], decision: expect.objectContaining({ mode: 'transcode' }) }));
    } finally { close(); }
  });

  it('does not read keyframes when the answer cannot be remux', async () => {
    const { planner, keyframes, file, close } = setup();
    try {
      expect(await planner.plan(file, undefined, { ...chrome, video: ['vp9'] })).toMatchObject({ mode: 'transcode' });
      expect(keyframes).not.toHaveBeenCalled();
    } finally { close(); }
  });

  it('plays directly, opening nothing, without a session service', async () => {
    const { planner, open, file, close } = setup({ sessions: false });
    try {
      const plan = await planner.plan(file, undefined, chrome);
      expect(plan).toMatchObject({ mode: 'direct', reasons: ['container', 'audio-codec', 'ffmpeg-missing'] });
      expect(plan.hls).toBeUndefined(); expect(open).not.toHaveBeenCalled();
    } finally { close(); }
  });

  it('plays directly when the probe fails', async () => {
    const { planner, open, file, close } = setup({ probe: false });
    try {
      expect(await planner.plan(file, undefined, chrome)).toMatchObject({ mode: 'direct', reasons: ['probe-failed'], audioTracks: [] });
      expect(open).not.toHaveBeenCalled();
    } finally { close(); }
  });
});
