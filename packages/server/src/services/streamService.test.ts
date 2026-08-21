import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../db/db.js';
import { FolderRepository } from '../repositories/folderRepository.js';
import { MovieRepository } from '../repositories/movieRepository.js';
import { PlaybackService } from './playbackService.js';
import { RangeError, StreamService } from './streamService.js';

const temporaryDirectories: string[] = [];
const cleanupActions: Array<() => void> = [];
afterEach(async () => { cleanupActions.splice(0).forEach((cleanup) => cleanup()); await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });

async function createStream() {
  const directory = await mkdtemp(join(tmpdir(), 'ottlib-')); temporaryDirectories.push(directory);
  const file = join(directory, 'Example.2024.mp4'); await writeFile(file, '0123456789');
  const db = createDatabase(directory); const folders = new FolderRepository(db); const movies = new MovieRepository(db); const folder = folders.create(directory);
  const now = new Date().toISOString(); const entry = movies.upsertScanned({ folderId: folder.id, path: file, filename: 'Example.2024.mp4', title: 'Example', year: 2024, size: 10, mtimeMs: (await stat(file)).mtimeMs, seenAt: now });
  cleanupActions.push(() => db.close()); return { stream: new StreamService(new PlaybackService(movies)), id: entry.id };
}

describe('StreamService', () => {
  it('serves fixed, open-ended, and suffix ranges', async () => {
    const { stream, id } = await createStream();
    await expect(stream.open(id, 'bytes=0-3', false)).resolves.toMatchObject({ statusCode: 206, headers: { 'content-range': 'bytes 0-3/10', 'content-length': '4' } });
    await expect(stream.open(id, 'bytes=8-', false)).resolves.toMatchObject({ headers: { 'content-range': 'bytes 8-9/10' } });
    await expect(stream.open(id, 'bytes=-3', false)).resolves.toMatchObject({ headers: { 'content-range': 'bytes 7-9/10' } });
  });

  it('supports HEAD-style responses and rejects unsatisfiable ranges', async () => {
    const { stream, id } = await createStream();
    await expect(stream.open(id, undefined, false)).resolves.toMatchObject({ statusCode: 200, headers: { 'content-length': '10' }, stream: undefined });
    await expect(stream.open(id, 'bytes=10-11', false)).rejects.toBeInstanceOf(RangeError);
    await expect(stream.open(id, 'bytes=0-1,2-3', false)).rejects.toBeInstanceOf(RangeError);
  });
});
