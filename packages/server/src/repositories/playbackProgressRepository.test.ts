import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../db/db.js';
import { MovieRepository } from './movieRepository.js';
import { PlaybackProgressRepository } from './playbackProgressRepository.js';
import { ProfileRepository } from './profileRepository.js';

const directories: string[] = [];
const device = '3f1c2a52-8a3b-4f0e-9a51-2d6f0f5d9c11';
const otherDevice = '00000000-0000-4000-8000-000000000000';

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'ottlib-progress-repo-')); directories.push(directory);
  const db = createDatabase(directory); db.prepare('INSERT INTO folders (path) VALUES (?)').run('E:/Movies');
  const movies = new MovieRepository(db);
  [1, 2, 3].forEach((id) => movies.upsertScanned({ folderId: 1, path: `E:/Movies/${id}.mkv`, filename: `${id}.mkv`, title: `Movie ${id}`, year: 2024, size: 1, mtimeMs: id, seenAt: '2026-01-01T00:00:00.000Z' }));
  const profiles = new ProfileRepository(db);
  const owner = profiles.getOwner()!.id; const kid = profiles.create({ name: 'Kid', color: '#17c964', pinHash: null }).id;
  return { db, movies, owner, kid, progress: new PlaybackProgressRepository(db) };
}

afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })));

describe('PlaybackProgressRepository', () => {
  it('upserts, clears, and scopes progress per profile, keeping the writing device as the last device', () => {
    const { db, movies, progress, owner, kid } = fixture();
    try {
      progress.set(1, owner, device, 60_000, 600_000); progress.set(1, owner, otherDevice, 90_000, 600_000);
      expect(progress.get(1, owner)).toMatchObject({ positionMs: 90_000, durationMs: 600_000, profileId: owner, deviceId: otherDevice });
      expect(progress.get(1, kid)).toBeUndefined();
      expect(movies.get(1, owner)?.resumePositionMs).toBe(90_000);
      expect(movies.get(1, kid)?.resumePositionMs).toBeNull();
      expect(movies.get(1)?.resumePositionMs).toBeNull();
      progress.set(1, kid, null, 30_000, 600_000);
      expect(progress.get(1, kid)).toMatchObject({ positionMs: 30_000, deviceId: null });
      progress.clear(1, owner);
      expect(progress.get(1, owner)).toBeUndefined();
      expect(progress.get(1, kid)?.positionMs).toBe(30_000);
    } finally { db.close(); }
  });

  it('lists continue-watching titles newest first and skips missing files', () => {
    const { db, movies, progress, owner, kid } = fixture();
    try {
      progress.set(1, owner, device, 1_000, 10_000);
      db.prepare("UPDATE playback_progress SET updated_at = '2026-01-01T00:00:00.000Z'").run();
      progress.set(2, owner, device, 2_000, 10_000);
      progress.set(3, owner, device, 3_000, 10_000); movies.markFolderMissing(99);
      db.prepare('UPDATE movies SET missing = 1 WHERE id = 3').run();
      const items = movies.listContinueWatching(owner, 10);
      expect(movies.listContinueWatching(kid, 10)).toEqual([]);
      expect(items.map((item) => item.id)).toEqual([2, 1]);
      expect(items[0]).toMatchObject({ resumePositionMs: 2_000 });
      expect(movies.listSummaries(owner).items.find((item) => item.id === 1)?.resumePositionMs).toBe(1_000);
    } finally { db.close(); }
  });
});
