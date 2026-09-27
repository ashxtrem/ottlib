import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../db/db.js';
import { MovieRepository } from '../repositories/movieRepository.js';
import { PlaybackProgressRepository } from '../repositories/playbackProgressRepository.js';
import { WatchStateRepository } from '../repositories/watchStateRepository.js';
import { PlaybackProgressService } from './playbackProgressService.js';

const directories: string[] = [];
const device = '3f1c2a52-8a3b-4f0e-9a51-2d6f0f5d9c11';

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'ottlib-progress-service-')); directories.push(directory);
  const db = createDatabase(directory); db.prepare('INSERT INTO folders (path) VALUES (?)').run('E:/Movies');
  new MovieRepository(db).upsertScanned({ folderId: 1, path: 'E:/Movies/1.mkv', filename: '1.mkv', title: 'Movie', year: 2024, size: 1, mtimeMs: 1, seenAt: '2026-01-01T00:00:00.000Z' });
  const progress = new PlaybackProgressRepository(db); const watches = new WatchStateRepository(db);
  return { db, progress, watches, service: new PlaybackProgressService(progress, watches) };
}

afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })));

describe('PlaybackProgressService', () => {
  it('saves a mid-title position', () => {
    const { db, service } = fixture();
    try { expect(service.record(1, device, { positionMs: 1_800_000, durationMs: 6_000_000 })).toEqual({ resumePositionMs: 1_800_000, watched: false }); } finally { db.close(); }
  });

  it('ignores and clears positions near the start', () => {
    const { db, service, progress } = fixture();
    try {
      service.record(1, device, { positionMs: 1_800_000, durationMs: 6_000_000 });
      expect(service.record(1, device, { positionMs: 30_000, durationMs: 6_000_000 })).toEqual({ resumePositionMs: null, watched: false });
      expect(progress.get(1, device)).toBeUndefined();
    } finally { db.close(); }
  });

  it('marks watched and clears progress near the end', () => {
    const { db, service, progress, watches } = fixture();
    try {
      service.record(1, device, { positionMs: 1_800_000, durationMs: 6_000_000 });
      expect(service.record(1, device, { positionMs: 5_600_000, durationMs: 6_000_000 })).toEqual({ resumePositionMs: null, watched: true });
      expect(progress.get(1, device)).toBeUndefined();
      expect(watches.get(1, device)).toBe(true);
    } finally { db.close(); }
  });

  it('clears progress when a title is marked watched manually', () => {
    const { db, service, progress } = fixture();
    try {
      service.record(1, device, { positionMs: 1_800_000, durationMs: 6_000_000 });
      service.setWatched(1, device, true);
      expect(progress.get(1, device)).toBeUndefined();
    } finally { db.close(); }
  });
});
