import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDatabase } from '../../db/db.js';
import { MovieRepository } from '../../repositories/movieRepository.js';
import { CreditsService } from './creditsService.js';

const directories: string[] = [];
afterEach(() => { directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })); });

const scanned = (name: string, size = 1, mtimeMs = 1) => ({ folderId: 1, path: `E:/Movies/${name}.mkv`, filename: `${name}.mkv`, title: name, year: 2024, size, mtimeMs, seenAt: '2026-01-01T00:00:00.000Z' });
const probe = (durationMs: number) => ({ container: 'MKV', durationMs, width: 1920, height: 1080, videoCodec: 'H264', videoProfile: null, videoBitRate: null, hdrFormat: null });

function setup(read: (path: string, durationMs: number) => Promise<number | null> = async () => null) {
  const directory = mkdtempSync(join(tmpdir(), 'ottlib-credits-'));
  directories.push(directory);
  const db = createDatabase(directory);
  db.prepare('INSERT INTO folders (path) VALUES (?)').run('E:/Movies');
  const movies = new MovieRepository(db);
  const reader = { read: vi.fn(read) };
  const log = vi.fn();
  const service = new CreditsService(movies, reader, log);
  const add = (name: string, probed = true, durationMs = 6_000_000) => {
    const { id } = movies.upsertScanned(scanned(name));
    if (probed) movies.applyMediaInfo(id, probe(durationMs));
    return id;
  };
  const row = (id: number) => db.prepare('SELECT credits_status AS status, credits_chapter_ms AS chapterMs, credits_mark_ms AS markMs FROM movies WHERE id = ?').get(id) as { status: string; chapterMs: number | null; markMs: number | null };
  return { db, movies, reader, log, service, add, row };
}

describe('CreditsService', () => {
  it('fills credits_chapter_ms for pending probed files, and marks files without a chapter done', async () => {
    const { db, service, add, row } = setup(async (path) => (path.includes('has') ? 5_400_000 : null));
    try {
      const withChapter = add('has'); const without = add('none');
      await service.runPending();
      expect(row(withChapter)).toMatchObject({ status: 'done', chapterMs: 5_400_000 });
      expect(row(without)).toMatchObject({ status: 'done', chapterMs: null });
    } finally { db.close(); }
  });

  it('passes the probed duration to the reader and skips unprobed files', async () => {
    const { db, reader, service, add, row } = setup();
    try {
      const probed = add('probed', true, 7_000_000); const unprobed = add('unprobed', false);
      await service.runPending();
      expect(reader.read).toHaveBeenCalledTimes(1);
      expect(reader.read).toHaveBeenCalledWith('E:/Movies/probed.mkv', 7_000_000);
      expect(row(probed).status).toBe('done');
      expect(row(unprobed).status).toBe('pending');
    } finally { db.close(); }
  });

  it('leaves a file pending when its chapters cannot be read, logs it, and does not retry it within the pass', async () => {
    const { db, reader, log, service, add, row } = setup(async (path) => { if (path.includes('bad')) throw new Error('ffprobe exploded'); return 5_000_000; });
    try {
      const bad = add('bad'); const good = add('good');
      await service.runPending();
      expect(row(bad).status).toBe('pending');
      expect(row(good)).toMatchObject({ status: 'done', chapterMs: 5_000_000 });
      expect(reader.read).toHaveBeenCalledTimes(2);
      expect(log).toHaveBeenCalledWith(expect.stringContaining('ffprobe exploded'));
    } finally { db.close(); }
  });

  it('is single-flight: a call during a run joins it and causes exactly one more run', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const { db, movies, reader, service, add, row } = setup(async () => { await gate; return 4_000_000; });
    try {
      const first = add('first');
      const run = service.runPending();
      await vi.waitFor(() => expect(reader.read).toHaveBeenCalledTimes(1));
      const second = movies.upsertScanned(scanned('second')).id;
      movies.applyMediaInfo(second, probe(6_000_000));
      const joined = service.runPending();
      service.runPending();
      release();
      await Promise.all([run, joined]);
      expect(reader.read).toHaveBeenCalledTimes(2);
      expect(row(first).status).toBe('done');
      expect(row(second)).toMatchObject({ status: 'done', chapterMs: 4_000_000 });
      await service.runPending();
      expect(reader.read).toHaveBeenCalledTimes(2);
    } finally { db.close(); }
  });

  it('never rejects, even when the repository throws', async () => {
    const { db, movies, log, service } = setup();
    try {
      vi.spyOn(movies, 'pendingCredits').mockImplementation(() => { throw new Error('db closed'); });
      await expect(service.runPending()).resolves.toBeUndefined();
      expect(log).toHaveBeenCalledWith(expect.stringContaining('db closed'));
    } finally { db.close(); }
  });

  it('drops a result when the file changed while its chapters were being read', async () => {
    const { db, movies, service, add, row } = setup(async () => {
      movies.upsertScanned(scanned('moving', 2, 1));
      return 5_000_000;
    });
    try {
      const id = add('moving');
      await service.runPending();
      // The second pass re-reads the changed (and still unprobed) file only once it is probed again.
      expect(row(id)).toMatchObject({ status: 'pending', chapterMs: null });
    } finally { db.close(); }
  });
});

describe('credits re-detection', () => {
  it('a size or mtime change resets the chapter to pending and keeps the mark', () => {
    const { db, movies, add, row } = setup();
    try {
      const id = add('example');
      movies.applyCreditsChapter(id, 5_400_000);
      movies.setCreditsMark(id, 5_000_000);
      movies.upsertScanned(scanned('example'));
      expect(row(id)).toEqual({ status: 'done', chapterMs: 5_400_000, markMs: 5_000_000 });
      movies.upsertScanned(scanned('example', 1, 2));
      expect(row(id)).toEqual({ status: 'pending', chapterMs: null, markMs: 5_000_000 });
      movies.applyCreditsChapter(id, 5_000_000);
      movies.upsertScanned(scanned('example', 9, 2));
      expect(row(id)).toEqual({ status: 'pending', chapterMs: null, markMs: 5_000_000 });
    } finally { db.close(); }
  });

  it('a probe that finds a different duration resets the chapter, one that finds the same does not', () => {
    const { db, movies, add, row } = setup();
    try {
      const id = add('example', true, 6_000_000);
      movies.applyCreditsChapter(id, 5_400_000);
      movies.setCreditsMark(id, 5_000_000);
      movies.applyMediaInfo(id, probe(6_000_000));
      expect(row(id)).toEqual({ status: 'done', chapterMs: 5_400_000, markMs: 5_000_000 });
      movies.applyMediaInfo(id, probe(6_100_000));
      expect(row(id)).toEqual({ status: 'pending', chapterMs: null, markMs: 5_000_000 });
    } finally { db.close(); }
  });

  it('a refresh (clear, then probe) of the same file keeps the chapter, a refresh that finds a new duration resets it', () => {
    const { db, movies, add, row } = setup();
    try {
      const id = add('example', true, 6_000_000);
      movies.applyCreditsChapter(id, 5_400_000);
      movies.clearMediaInfo(id);
      movies.applyMediaInfo(id, probe(6_000_000));
      expect(row(id)).toMatchObject({ status: 'done', chapterMs: 5_400_000 });
      movies.clearMediaInfo(id);
      movies.applyMediaInfo(id, probe(5_900_000));
      expect(row(id)).toMatchObject({ status: 'pending', chapterMs: null });
    } finally { db.close(); }
  });

  it('lists only available probed pending files after the cursor', () => {
    const { db, movies, add } = setup();
    try {
      const a = add('a'); const b = add('b'); add('unprobed', false);
      const c = add('c'); movies.applyCreditsChapter(c, null);
      expect(movies.pendingCredits(10).map((row) => row.id)).toEqual([a, b]);
      expect(movies.pendingCredits(10, a).map((row) => row.id)).toEqual([b]);
      expect(movies.pendingCredits(1)).toEqual([{ id: a, path: 'E:/Movies/a.mkv', durationMs: 6_000_000, size: 1, mtimeMs: 1 }]);
      movies.markFolderMissing(1);
      expect(movies.pendingCredits(10)).toEqual([]);
    } finally { db.close(); }
  });
});
