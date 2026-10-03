import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it, vi } from 'vitest';
import { createDatabase } from '../../db/db.js';
import { MovieRepository } from '../../repositories/movieRepository.js';
import { DownloadedSubtitleRepository } from '../../repositories/downloadedSubtitleRepository.js';
import { SubtitleLibraryService } from './subtitleLibraryService.js';

it('persists stable sources and uses managed storage when a sidecar cannot be written', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'subtitle-library-')); const db = createDatabase(join(folder, 'data'));
  try {
    const media = join(folder, 'media'); await mkdir(media);
    const path = join(media, 'movie.mkv'); await writeFile(path, 'video');
    db.prepare('INSERT INTO folders (path) VALUES (?)').run(media);
    new MovieRepository(db).upsertScanned({ folderId: 1, path, filename: 'movie.mkv', title: 'Movie', year: null, size: 5, mtimeMs: 1, seenAt: '2026-01-01' });
    const records = new DownloadedSubtitleRepository(db); const library = new SubtitleLibraryService(records, join(folder, 'data'));
    const result = { provider: 'test', remoteId: '1', language: 'en', releaseName: 'Movie', format: 'srt', hearingImpaired: false, forced: false, hashMatch: false, downloads: 0, score: 0 };
    const download = vi.fn().mockResolvedValue({ bytes: Buffer.from('1\n00:00:01,000 --> 00:00:02,000\nHello'), filename: 'movie.srt' });
    // A missing media directory simulates an unavailable/read-only destination without platform-specific permissions.
    const saved = await library.save(1, join(folder, 'unwritable', 'movie.mkv'), result, download);
    expect(records.list(1)[0].sidecar_path).toBeNull();
    const reopened = new SubtitleLibraryService(new DownloadedSubtitleRepository(db), join(folder, 'data'));
    expect(reopened.source((await reopened.list(1))[0])).toEqual(saved.subtitle);
    const file = await reopened.file(1, 1_000_001); expect(await readFile(file.path, 'utf8')).toContain('Hello');
    expect((await reopened.save(1, path, result, download)).reused).toBe(true); expect(download).toHaveBeenCalledTimes(1);
    expect((await stat(file.path)).isFile()).toBe(true);
    await expect(reopened.file(2, 1_000_001)).rejects.toThrow('unavailable');
  } finally { db.close(); await rm(folder, { recursive: true, force: true }); }
});
