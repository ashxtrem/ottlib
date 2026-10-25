import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDatabase } from '../../db/db.js';
import type { FfmpegBinary } from '../../providers/transcode/ffmpegLocator.js';
import { MovieRepository } from '../../repositories/movieRepository.js';
import type { CropBox } from './pictureAreaMath.js';
import type { PictureDetector } from './cropDetector.js';
import { PictureAreaService } from './pictureAreaService.js';

const directories: string[] = [];
afterEach(() => { directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })); });

const ffmpeg: FfmpegBinary = { path: 'ffmpeg', version: 'test', encoders: new Set(), filters: new Set(), run: async () => ({ code: 0, stdout: '', stderr: '' }) };
const same = (box: CropBox): CropBox[] => [box, box, box, box];
const scanned = (name: string, size = 1) => ({ folderId: 1, path: `E:/Movies/${name}.mkv`, filename: `${name}.mkv`, title: name, year: 2024, size, mtimeMs: 1, seenAt: '2026-01-01T00:00:00.000Z' });

function setup(detect: PictureDetector['detect'] = async () => []) {
  const directory = mkdtempSync(join(tmpdir(), 'ottlib-picture-'));
  directories.push(directory);
  const db = createDatabase(directory);
  db.prepare('INSERT INTO folders (path) VALUES (?)').run('E:/Movies');
  const movies = new MovieRepository(db);
  const detector = { detect: vi.fn(detect) };
  const locate = vi.fn(async (): Promise<FfmpegBinary | null> => ffmpeg);
  const service = new PictureAreaService(movies, locate, detector);
  const add = (name: string, probed = true) => {
    const { id } = movies.upsertScanned(scanned(name));
    if (probed) movies.applyMediaInfo(id, { container: 'MKV', durationMs: 7_000_000, width: 3840, height: 2160, videoCodec: 'HEVC', videoProfile: null, videoBitRate: null, hdrFormat: null });
    return id;
  };
  return { db, movies, detector, locate, service, add };
}

describe('PictureAreaService', () => {
  it('turns pending rows into done (bars found) or none (full frame)', async () => {
    const { db, movies, service, add } = setup(async (_ffmpeg, path) => same(path.includes('wide') ? { w: 3840, h: 1632, x: 0, y: 264 } : { w: 3840, h: 2160, x: 0, y: 0 }));
    try {
      const wide = add('wide'); const full = add('full');
      await service.runPending();
      expect(movies.getPictureArea(wide)).toEqual({ x: 0, y: 264, width: 3840, height: 1632 });
      expect(movies.getPictureArea(full)).toBeNull();
      const status = (id: number) => (db.prepare('SELECT picture_status FROM movies WHERE id = ?').get(id) as { picture_status: string }).picture_status;
      expect(status(wide)).toBe('done');
      expect(status(full)).toBe('none');
      expect(movies.listPicturePending(10)).toEqual([]);
    } finally { db.close(); }
  });

  it('marks a title failed when too few samples work', async () => {
    const { db, movies, service, add } = setup(async () => [{ w: 3840, h: 1632, x: 0, y: 264 }]);
    try {
      const id = add('dark');
      await service.runPending();
      expect(movies.getPictureArea(id)).toBeNull();
      expect(db.prepare('SELECT picture_status FROM movies WHERE id = ?').get(id)).toEqual({ picture_status: 'failed' });
    } finally { db.close(); }
  });

  it('measures again after the file changes', async () => {
    const { db, movies, service, add } = setup(async () => same({ w: 3840, h: 1632, x: 0, y: 264 }));
    try {
      const id = add('changing');
      await service.runPending();
      expect(movies.getPictureArea(id)).not.toBeNull();
      movies.upsertScanned(scanned('changing', 1));
      expect(movies.getPictureArea(id)).not.toBeNull();
      movies.upsertScanned(scanned('changing', 2));
      expect(movies.getPictureArea(id)).toBeNull();
      expect(db.prepare('SELECT picture_status, picture_x, picture_height FROM movies WHERE id = ?').get(id)).toEqual({ picture_status: 'pending', picture_x: null, picture_height: null });
    } finally { db.close(); }
  });

  it('does not start a second pass while one is running', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const { db, detector, locate, service, add } = setup(async () => { await gate; return same({ w: 3840, h: 2160, x: 0, y: 0 }); });
    try {
      add('slow');
      const first = service.runPending();
      const second = service.runPending();
      expect(second).toBe(first);
      release();
      await first;
      expect(detector.detect).toHaveBeenCalledTimes(1);
      expect(locate).toHaveBeenCalledTimes(1);
      await service.runPending();
      expect(locate).toHaveBeenCalledTimes(2);
    } finally { db.close(); }
  });

  it('skips unprobed rows, leaves them pending and still ends with more of them than one batch', async () => {
    const { db, movies, detector, service, add } = setup(async () => same({ w: 3840, h: 2160, x: 0, y: 0 }));
    try {
      for (let index = 0; index < 45; index += 1) add(`unprobed-${index}`, false);
      const probed = add('probed');
      await service.runPending();
      expect(detector.detect).toHaveBeenCalledTimes(1);
      expect(movies.listPicturePending(100)).toHaveLength(45);
      expect(db.prepare('SELECT picture_status FROM movies WHERE id = ?').get(probed)).toEqual({ picture_status: 'none' });
    } finally { db.close(); }
  });

  it('leaves everything pending when ffmpeg is missing', async () => {
    const { db, movies, detector, locate, service, add } = setup();
    try {
      add('a');
      locate.mockResolvedValue(null);
      await service.runPending();
      expect(detector.detect).not.toHaveBeenCalled();
      expect(movies.listPicturePending(10)).toHaveLength(1);
    } finally { db.close(); }
  });

  it('marks a title failed when its detector throws and carries on with the next', async () => {
    const { db, movies, service, add } = setup(async (_ffmpeg, path) => { if (path.includes('bad')) throw new Error('boom'); return same({ w: 3840, h: 1632, x: 0, y: 264 }); });
    try {
      const bad = add('bad'); const good = add('good');
      await service.runPending();
      expect(db.prepare('SELECT picture_status FROM movies WHERE id = ?').get(bad)).toEqual({ picture_status: 'failed' });
      expect(movies.getPictureArea(good)).not.toBeNull();
    } finally { db.close(); }
  });
});
