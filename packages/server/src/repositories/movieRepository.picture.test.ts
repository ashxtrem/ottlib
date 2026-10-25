import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../db/db.js';
import { MovieRepository } from './movieRepository.js';

const directories: string[] = [];
afterEach(() => { directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })); });

function setup() {
  const directory = mkdtempSync(join(tmpdir(), 'ottlib-picture-repo-'));
  directories.push(directory);
  const db = createDatabase(directory);
  db.prepare('INSERT INTO folders (path) VALUES (?)').run('E:/Movies');
  const movies = new MovieRepository(db);
  const scanned = { folderId: 1, path: 'E:/Movies/example.mkv', filename: 'example.mkv', title: 'Example', year: 2024, size: 1, mtimeMs: 1, seenAt: '2026-01-01T00:00:00.000Z' };
  const { id } = movies.upsertScanned(scanned);
  return { db, movies, id, scanned };
}

const area = { x: 0, y: 264, width: 3840, height: 1632 };
const probe = { container: 'MKV', durationMs: 7_000_000, width: 3840, height: 2160, videoCodec: 'HEVC', videoProfile: null, videoBitRate: null, hdrFormat: null };

describe('MovieRepository picture area', () => {
  it('starts pending and returns the area only when the status is done', () => {
    const { db, movies, id } = setup();
    try {
      expect(movies.getPictureArea(id)).toBeNull();
      movies.applyPictureArea(id, area, 'done');
      expect(movies.getPictureArea(id)).toEqual(area);
      movies.applyPictureArea(id, area, 'none');
      expect(movies.getPictureArea(id)).toBeNull();
      movies.applyPictureArea(id, null, 'failed');
      expect(movies.getPictureArea(id)).toBeNull();
      expect(movies.getPictureArea(999)).toBeNull();
    } finally { db.close(); }
  });

  it('lists pending available files after a cursor, with frame data only once probed', () => {
    const { db, movies, id, scanned } = setup();
    try {
      expect(movies.listPicturePending(10)).toEqual([{ id, path: 'E:/Movies/example.mkv', durationMs: null, frameWidth: null, frameHeight: null }]);
      movies.applyMediaInfo(id, probe);
      expect(movies.listPicturePending(10)).toEqual([{ id, path: 'E:/Movies/example.mkv', durationMs: 7_000_000, frameWidth: 3840, frameHeight: 2160 }]);
      expect(movies.listPicturePending(10, id)).toEqual([]);
      movies.applyPictureArea(id, null, 'none');
      expect(movies.listPicturePending(10)).toEqual([]);
      db.prepare("UPDATE movies SET picture_status = 'pending', missing = 1 WHERE id = ?").run(id);
      expect(movies.listPicturePending(10)).toEqual([]);
      expect(scanned.path).toBeTruthy();
    } finally { db.close(); }
  });

  it('goes back to pending when the file size or mtime changes, not on a plain rescan', () => {
    const { db, movies, id, scanned } = setup();
    try {
      movies.applyPictureArea(id, area, 'done');
      movies.upsertScanned(scanned);
      expect(movies.getPictureArea(id)).toEqual(area);
      movies.upsertScanned({ ...scanned, mtimeMs: 2 });
      expect(movies.getPictureArea(id)).toBeNull();
      expect(db.prepare('SELECT picture_status, picture_y FROM movies WHERE id = ?').get(id)).toEqual({ picture_status: 'pending', picture_y: null });
    } finally { db.close(); }
  });

  it('clearing media info also clears the picture area', () => {
    const { db, movies, id } = setup();
    try {
      movies.applyPictureArea(id, area, 'done');
      movies.clearMediaInfo(id);
      expect(movies.getPictureArea(id)).toBeNull();
      expect(db.prepare('SELECT picture_status, picture_width FROM movies WHERE id = ?').get(id)).toEqual({ picture_status: 'pending', picture_width: null });
    } finally { db.close(); }
  });

  it('does not put the area on the Movie sent to clients', () => {
    const { db, movies, id } = setup();
    try {
      movies.applyPictureArea(id, area, 'done');
      expect(JSON.stringify(movies.get(id))).not.toContain('picture');
    } finally { db.close(); }
  });
});
