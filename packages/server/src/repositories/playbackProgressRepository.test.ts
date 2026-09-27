import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../db/db.js';
import { MovieRepository } from './movieRepository.js';
import { PlaybackProgressRepository } from './playbackProgressRepository.js';

const directories: string[] = [];
const device = '3f1c2a52-8a3b-4f0e-9a51-2d6f0f5d9c11';

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'ottlib-progress-repo-')); directories.push(directory);
  const db = createDatabase(directory); db.prepare('INSERT INTO folders (path) VALUES (?)').run('E:/Movies');
  const movies = new MovieRepository(db);
  [1, 2, 3].forEach((id) => movies.upsertScanned({ folderId: 1, path: `E:/Movies/${id}.mkv`, filename: `${id}.mkv`, title: `Movie ${id}`, year: 2024, size: 1, mtimeMs: id, seenAt: '2026-01-01T00:00:00.000Z' }));
  return { db, movies, progress: new PlaybackProgressRepository(db) };
}

afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })));

describe('PlaybackProgressRepository', () => {
  it('upserts, clears, and scopes progress per device', () => {
    const { db, movies, progress } = fixture();
    try {
      progress.set(1, device, 60_000, 600_000); progress.set(1, device, 90_000, 600_000);
      expect(progress.get(1, device)).toMatchObject({ positionMs: 90_000, durationMs: 600_000 });
      expect(progress.get(1, '00000000-0000-4000-8000-000000000000')).toBeUndefined();
      expect(movies.get(1, device)?.resumePositionMs).toBe(90_000);
      expect(movies.get(1)?.resumePositionMs).toBeNull();
      progress.clear(1, device);
      expect(progress.get(1, device)).toBeUndefined();
    } finally { db.close(); }
  });

  it('lists continue-watching titles newest first and skips missing files', () => {
    const { db, movies, progress } = fixture();
    try {
      progress.set(1, device, 1_000, 10_000);
      db.prepare("UPDATE playback_progress SET updated_at = '2026-01-01T00:00:00.000Z'").run();
      progress.set(2, device, 2_000, 10_000);
      progress.set(3, device, 3_000, 10_000); movies.markFolderMissing(99);
      db.prepare('UPDATE movies SET missing = 1 WHERE id = 3').run();
      const items = movies.listContinueWatching(device, 10);
      expect(items.map((item) => item.id)).toEqual([2, 1]);
      expect(items[0]).toMatchObject({ resumePositionMs: 2_000 });
      expect(movies.listSummaries(device).items.find((item) => item.id === 1)?.resumePositionMs).toBe(1_000);
    } finally { db.close(); }
  });
});
