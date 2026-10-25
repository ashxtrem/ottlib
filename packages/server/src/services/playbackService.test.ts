import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../db/db.js';
import { FolderRepository } from '../repositories/folderRepository.js';
import { MovieRepository } from '../repositories/movieRepository.js';
import { PlaybackService } from './playbackService.js';
import type { PlaybackPlan, PlaybackPlanner } from './playbackPlanner.js';

const temporaryDirectories: string[] = [];
const cleanupActions: Array<() => void> = [];
afterEach(async () => { cleanupActions.splice(0).forEach((cleanup) => cleanup()); await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });

const directPlan: PlaybackPlan = { mode: 'direct', reasons: [], audioTracks: [], burnInSubtitles: [] };
const plannerFor = (plan: PlaybackPlan): PlaybackPlanner => ({ plan: async () => plan }) as unknown as PlaybackPlanner;

async function create(plan?: PlaybackPlan) {
  const directory = await mkdtemp(join(tmpdir(), 'ottlib-playback-service-')); temporaryDirectories.push(directory);
  const file = join(directory, 'Example.2024.mkv'); await writeFile(file, '0123456789');
  const db = createDatabase(directory); const movies = new MovieRepository(db); const folder = new FolderRepository(db).create(directory);
  const entry = movies.upsertScanned({ folderId: folder.id, path: file, filename: 'Example.2024.mkv', title: 'Example', year: 2024, size: 10, mtimeMs: (await stat(file)).mtimeMs, seenAt: new Date().toISOString() });
  movies.applyMediaInfo(entry.id, { container: 'MKV', durationMs: 60_000, width: 3840, height: 2160, videoCodec: 'HEVC', videoProfile: 'Main 10', videoBitRate: 1, hdrFormat: null });
  cleanupActions.push(() => db.close());
  return { movies, id: entry.id, service: new PlaybackService(movies, () => '', undefined, undefined, plan ? plannerFor(plan) : undefined) };
}

describe('PlaybackService picture area', () => {
  it('sends the detected area as fractions of the frame', async () => {
    const { movies, id, service } = await create(directPlan);
    movies.applyPictureArea(id, { x: 0, y: 270, width: 3840, height: 1620 }, 'done');
    expect((await service.source(id, undefined, {})).pictureArea).toEqual({ x: 0, y: 0.125, width: 1, height: 0.75 });
    expect((await service.source(id, undefined)).pictureArea).toEqual({ x: 0, y: 0.125, width: 1, height: 0.75 });
  });

  it('sends null when burning in subtitles, since the filter draws inside the bars', async () => {
    const { movies, id, service } = await create({ ...directPlan, mode: 'transcode', burnSubtitleOrder: 2 });
    movies.applyPictureArea(id, { x: 0, y: 270, width: 3840, height: 1620 }, 'done');
    expect((await service.source(id, undefined, {})).pictureArea).toBeNull();
  });

  it('sends null while detection is pending, none or failed', async () => {
    const { movies, id, service } = await create(directPlan);
    for (const status of ['pending', 'none', 'failed'] as const) {
      movies.applyPictureArea(id, null, status);
      expect((await service.source(id, undefined, {})).pictureArea).toBeNull();
    }
  });

  it('sends null when the frame size is unknown', async () => {
    const { movies, id, service } = await create(directPlan);
    movies.applyMediaInfo(id, { container: 'MKV', durationMs: 60_000, width: null, height: null, videoCodec: 'HEVC', videoProfile: null, videoBitRate: null, hdrFormat: null });
    movies.applyPictureArea(id, { x: 0, y: 270, width: 3840, height: 1620 }, 'done');
    expect((await service.source(id, undefined, {})).pictureArea).toBeNull();
  });
});
