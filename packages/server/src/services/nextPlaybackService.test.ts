import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../db/db.js';
import { MovieRepository } from '../repositories/movieRepository.js';
import { ShelfMovieRepository } from '../repositories/shelfMovieRepository.js';
import { PlaybackProgressRepository } from '../repositories/playbackProgressRepository.js';
import { WatchStateRepository } from '../repositories/watchStateRepository.js';
import { NextPlaybackService } from './nextPlaybackService.js';
import { PlaybackProgressService } from './playbackProgressService.js';

const directories: string[] = [];
const device = '3f1c2a52-8a3b-4f0e-9a51-2d6f0f5d9c11';
const other = '00000000-0000-4000-8000-000000000000';
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'ottlib-next-')); directories.push(directory);
  const db = createDatabase(directory);
  db.prepare('INSERT INTO folders (path) VALUES (?)').run('E:/Movies');
  const movies = new MovieRepository(db);
  for (let id = 1; id <= 6; id++) movies.upsertScanned({ folderId: 1, path: `E:/Movies/${id}.mkv`, filename: `${id}.mkv`, title: `Movie ${id}`, year: 2024, size: 1, mtimeMs: 1, seenAt: '2026-01-01T00:00:00.000Z' });
  const shelves = new ShelfMovieRepository(db); const progress = new PlaybackProgressRepository(db); const watches = new WatchStateRepository(db);
  const next = new NextPlaybackService(movies, shelves, progress, watches);
  const service = new PlaybackProgressService(progress, watches, next);
  function episode(id: number, season: number, number: number, show = '291') {
    movies.applyMetadata(id, { source: 'tmdb', providerId: show, mediaType: 'tv', season, episode: number, title: `Show S${season}E${number}`, year: 2024, overview: null, posterFile: null, backdropFile: null, genres: [], cast: [], rating: null, runtime: null, imdbId: null });
  }
  return { db, movies, shelves, progress, watches, next, service, episode };
}
afterEach(() => directories.splice(0).forEach(dir => rmSync(dir, { force: true, recursive: true })));

describe('next playback', () => {
  it('uses numeric episode order, excludes duplicates and other shows, crosses seasons and skips missing files', () => {
    const { db, episode, next } = fixture();
    try {
      episode(1, 1, 9); episode(2, 1, 10); episode(3, 1, 9); episode(4, 1, 10, 'other'); episode(5, 2, 1); episode(6, 2, 2);
      expect(next.next(1, device)?.id).toBe(2);
      db.prepare('UPDATE movies SET missing = 1 WHERE id = 2').run();
      expect(next.next(1, device)?.id).toBe(5);
      expect(next.next(5, device)?.id).toBe(6);
      expect(next.next(6, device)).toBeNull();
    } finally { db.close(); }
  });

  it('completes and queues the next episode per device without resetting existing progress', () => {
    const { db, episode, service, movies, progress, watches } = fixture();
    try {
      episode(1, 1, 1); episode(2, 1, 2);
      service.record(1, device, { positionMs: 1_000_000, durationMs: 1_000_000 });
      expect(watches.get(1, device)).toBe(true);
      expect(movies.listContinueWatching(device, 10)).toMatchObject([{ id: 2, resumePositionMs: 0, nextUp: 'episode' }]);
      expect(movies.listContinueWatching(other, 10)).toEqual([]);
      progress.set(2, device, 150_000, 1_000_000);
      service.complete(1, device);
      expect(progress.get(2, device)?.positionMs).toBe(150_000);
      service.complete(2, device);
      service.complete(1, device);
      expect(movies.listContinueWatching(device, 10)).toEqual([]);
    } finally { db.close(); }
  });

  it('preserves a selected collection through progress, completion, and starting its queued title', () => {
    const { db, shelves, next, service, movies } = fixture();
    try {
      db.prepare("INSERT INTO shelves (name) VALUES ('MCU')").run();
      shelves.addMovies(1, [3, 1, 2, 4]);
      expect(next.next(3, device, 1)?.id).toBe(1);
      expect(next.next(3, device)).toBeNull();
      service.record(3, device, { positionMs: 150_000, durationMs: 1_000_000, shelfId: 1 });
      service.record(3, device, { positionMs: 1_000_000, durationMs: 1_000_000 });
      expect(movies.listContinueWatching(device, 10)).toMatchObject([{ id: 1, nextUp: 'collection' }]);
      service.record(1, device, { positionMs: 10_000, durationMs: 1_000_000 });
      expect(next.next(1, device)?.id).toBe(2);
      service.complete(1, device);
      expect(next.next(1, device)?.id).toBe(2);
      expect(movies.listContinueWatching(device, 10).map(item => item.id)).toEqual([2]);
    } finally { db.close(); }
  });

  it('does not queue unrelated library titles, invalid shelves, watched titles, or missing files', () => {
    const { db, service, next, shelves, watches, movies } = fixture();
    try {
      expect(next.next(1, device, 999)).toBeNull();
      service.complete(1, device);
      expect(movies.listContinueWatching(device, 10)).toEqual([]);
      db.prepare("INSERT INTO shelves (name) VALUES ('Collection')").run();
      shelves.addMovies(1, [1, 2, 3]);
      db.prepare('UPDATE movies SET missing = 1 WHERE id = 2').run();
      expect(next.next(1, device, 1)?.id).toBe(3);
      watches.set(3, device, true);
      service.complete(1, device, 1);
      expect(movies.listContinueWatching(device, 10)).toEqual([]);
    } finally { db.close(); }
  });
});
