import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../db/db.js';
import { MovieRepository } from '../repositories/movieRepository.js';
import { PlaybackHistoryRepository } from '../repositories/playbackHistoryRepository.js';
import { PlaybackProgressRepository } from '../repositories/playbackProgressRepository.js';
import { ProfileRepository } from '../repositories/profileRepository.js';
import { WatchStateRepository } from '../repositories/watchStateRepository.js';
import { PlaybackHistoryService } from './playbackHistoryService.js';
import { PlaybackProgressService } from './playbackProgressService.js';
import type { Viewer } from './viewer.js';

const directories: string[] = [];
const device = '3f1c2a52-8a3b-4f0e-9a51-2d6f0f5d9c11';
const otherDevice = '00000000-0000-4000-8000-000000000000';

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'ottlib-progress-service-')); directories.push(directory);
  const db = createDatabase(directory); db.prepare('INSERT INTO folders (path) VALUES (?)').run('E:/Movies');
  new MovieRepository(db).upsertScanned({ folderId: 1, path: 'E:/Movies/1.mkv', filename: '1.mkv', title: 'Movie', year: 2024, size: 1, mtimeMs: 1, seenAt: '2026-01-01T00:00:00.000Z' });
  const profiles = new ProfileRepository(db);
  const owner: Viewer = { profileId: profiles.getOwner()!.id, deviceId: device };
  const kid: Viewer = { profileId: profiles.create({ name: 'Kid', color: '#17c964', pinHash: null }).id, deviceId: device };
  const progress = new PlaybackProgressRepository(db); const watches = new WatchStateRepository(db); const records = new PlaybackHistoryRepository(db);
  const history = new PlaybackHistoryService(records, progress);
  const plays = () => db.prepare('SELECT method, start_position_ms AS start, end_position_ms AS end, ended_at IS NOT NULL AS ended, completed FROM playback_history ORDER BY id').all();
  return { db, progress, watches, history, plays, owner, kid, service: new PlaybackProgressService(progress, watches, undefined, history) };
}

afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })));

describe('PlaybackProgressService', () => {
  it('saves a mid-title position', () => {
    const { db, service, owner } = fixture();
    try { expect(service.record(1, owner, { positionMs: 1_800_000, durationMs: 6_000_000 })).toEqual({ resumePositionMs: 1_800_000, watched: false }); } finally { db.close(); }
  });

  it('ignores and clears positions near the start', () => {
    const { db, service, progress, owner } = fixture();
    try {
      service.record(1, owner, { positionMs: 1_800_000, durationMs: 6_000_000 });
      expect(service.record(1, owner, { positionMs: 30_000, durationMs: 6_000_000 })).toEqual({ resumePositionMs: null, watched: false });
      expect(progress.get(1, owner.profileId)).toBeUndefined();
    } finally { db.close(); }
  });

  it('marks watched and clears progress near the end', () => {
    const { db, service, progress, watches, owner } = fixture();
    try {
      service.record(1, owner, { positionMs: 1_800_000, durationMs: 6_000_000 });
      expect(service.record(1, owner, { positionMs: 5_600_000, durationMs: 6_000_000 })).toEqual({ resumePositionMs: null, watched: true });
      expect(progress.get(1, owner.profileId)).toBeUndefined();
      expect(watches.get(1, owner.profileId)).toBe(true);
    } finally { db.close(); }
  });

  it('clears progress when a title is marked watched manually', () => {
    const { db, service, progress, owner } = fixture();
    try {
      service.record(1, owner, { positionMs: 1_800_000, durationMs: 6_000_000 });
      service.setWatched(1, owner, true);
      expect(progress.get(1, owner.profileId)).toBeUndefined();
    } finally { db.close(); }
  });

  it('keeps progress and watched marks per profile, shared by every device of that profile', () => {
    const { db, service, progress, watches, owner, kid } = fixture();
    try {
      service.record(1, owner, { positionMs: 1_800_000, durationMs: 6_000_000 });
      expect(progress.get(1, kid.profileId)).toBeUndefined();
      const sameProfileElsewhere: Viewer = { ...owner, deviceId: otherDevice };
      expect(progress.get(1, owner.profileId)).toMatchObject({ positionMs: 1_800_000, deviceId: device });
      service.record(1, sameProfileElsewhere, { positionMs: 2_400_000, durationMs: 6_000_000 });
      expect(progress.get(1, owner.profileId)).toMatchObject({ positionMs: 2_400_000, deviceId: otherDevice });
      service.setWatched(1, kid, true);
      expect(watches.get(1, kid.profileId)).toBe(true);
      expect(watches.get(1, owner.profileId)).toBe(false);
      expect(progress.get(1, owner.profileId)?.positionMs).toBe(2_400_000);
    } finally { db.close(); }
  });
});

describe('play history on progress saves', () => {
  it('finishes the open play with the saved position, and completes it at the watched threshold', () => {
    const { db, service, history, plays, owner } = fixture();
    try {
      history.start(owner, 1, 'm3u', 60_000);
      service.record(1, owner, { positionMs: 1_800_000, durationMs: 6_000_000 });
      expect(plays()).toEqual([{ method: 'm3u', start: 60_000, end: 1_800_000, ended: 1, completed: 0 }]);
      service.record(1, owner, { positionMs: 2_000_000, durationMs: 6_000_000 });
      expect(plays()).toEqual([{ method: 'm3u', start: 60_000, end: 2_000_000, ended: 1, completed: 0 }]);
      service.record(1, owner, { positionMs: 5_800_000, durationMs: 6_000_000 });
      expect(plays()).toEqual([{ method: 'm3u', start: 60_000, end: 5_800_000, ended: 1, completed: 1 }]);
    } finally { db.close(); }
  });

  it('opens one android_app play when progress arrives without an announced play, and a new one after completion', () => {
    const { db, service, plays, owner } = fixture();
    try {
      service.record(1, owner, { positionMs: 1_800_000, durationMs: 6_000_000 });
      service.record(1, owner, { positionMs: 1_900_000, durationMs: 6_000_000 });
      expect(plays()).toEqual([{ method: 'android_app', start: 0, end: 1_900_000, ended: 1, completed: 0 }]);
      service.complete(1, owner);
      expect(plays()).toEqual([{ method: 'android_app', start: 0, end: 1_900_000, ended: 1, completed: 1 }]);
      service.record(1, owner, { positionMs: 300_000, durationMs: 6_000_000 });
      expect(plays()).toHaveLength(2);
      expect(plays()[1]).toEqual({ method: 'android_app', start: 0, end: 300_000, ended: 1, completed: 0 });
    } finally { db.close(); }
  });

  it('leaves plays older than 12 hours and other profiles\' plays alone', () => {
    const { db, service, history, plays, owner, kid } = fixture();
    try {
      const old = history.start(owner, 1, 'm3u');
      db.prepare("UPDATE playback_history SET started_at = '2020-01-01T00:00:00.000Z' WHERE id = ?").run(old);
      history.start(kid, 1, 'intent');
      service.record(1, owner, { positionMs: 1_800_000, durationMs: 6_000_000 });
      expect(plays()).toEqual([
        { method: 'm3u', start: 0, end: null, ended: 0, completed: 0 },
        { method: 'intent', start: 0, end: null, ended: 0, completed: 0 },
        { method: 'android_app', start: 0, end: 1_800_000, ended: 1, completed: 0 }
      ]);
    } finally { db.close(); }
  });

  it('starts an announced play from the profile\'s resume point unless a position is given', () => {
    const { db, service, history, plays, owner } = fixture();
    try {
      service.record(1, owner, { positionMs: 1_800_000, durationMs: 6_000_000 });
      db.prepare('DELETE FROM playback_history').run();
      history.start(owner, 1, 'local_launch');
      history.start(owner, 1, 'm3u', 42_000);
      expect(plays()).toMatchObject([{ method: 'local_launch', start: 1_800_000 }, { method: 'm3u', start: 42_000 }]);
    } finally { db.close(); }
  });
});
