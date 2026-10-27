import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDatabase } from '../db/db.js';
import { FolderRepository } from '../repositories/folderRepository.js';
import { MovieRepository } from '../repositories/movieRepository.js';
import { ScanRunRepository } from '../repositories/scanRunRepository.js';
import { SettingRepository } from '../repositories/settingRepository.js';
import type { MediaInfoService } from './mediaInfoService.js';
import type { MetadataMatchService } from './metadataMatchService.js';
import { ScanService } from './scanService.js';

const directories: string[] = [];
afterEach(() => { directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })); });

function setup(runPending: () => Promise<void>, runCredits: () => Promise<void> = async () => undefined) {
  const root = mkdtempSync(join(tmpdir(), 'ottlib-scan-'));
  directories.push(root);
  const library = join(root, 'library');
  mkdirSync(library);
  writeFileSync(join(library, 'Example (2024).mkv'), 'x');
  const db = createDatabase(join(root, 'data'));
  const folders = new FolderRepository(db);
  folders.create(library);
  const runs = new ScanRunRepository(db);
  const pictureArea = { runPending: vi.fn(runPending) };
  const credits = { runPending: vi.fn(runCredits) };
  const service = new ScanService(folders, new MovieRepository(db), runs, new SettingRepository(db), { suggest: vi.fn() } as unknown as MetadataMatchService, { refresh: vi.fn() } as unknown as MediaInfoService, pictureArea, credits);
  return { db, runs, pictureArea, credits, service };
}

async function finished(runs: ScanRunRepository, id: number) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const run = runs.get(id);
    if (run && run.status !== 'running') return run;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('scan did not finish');
}

describe('ScanService picture detection', () => {
  it('finishes the scan without waiting for detection, then triggers runPending', async () => {
    const { db, runs, pictureArea, service } = setup(() => new Promise<void>(() => undefined));
    try {
      const run = await finished(runs, service.start().id);
      expect(run.status).toBe('completed');
      expect(run.filesProcessed).toBe(1);
      expect(pictureArea.runPending).toHaveBeenCalledTimes(1);
    } finally { db.close(); }
  });

  it('never lets a detection error into the scan', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { db, runs, pictureArea, service } = setup(() => Promise.reject(new Error('ffmpeg exploded')));
    try {
      const run = await finished(runs, service.start().id);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(run.status).toBe('completed');
      expect(run.errorSummary).toBeNull();
      expect(pictureArea.runPending).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalled();
    } finally { error.mockRestore(); db.close(); }
  });

  it('survives runPending throwing synchronously', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { db, runs, service } = setup(() => { throw new Error('sync boom'); });
    try {
      expect((await finished(runs, service.start().id)).status).toBe('completed');
    } finally { error.mockRestore(); db.close(); }
  });

  it('starts the credits chapter pass after the scan and never lets its failure into the scan', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { db, runs, credits, service } = setup(async () => undefined, () => Promise.reject(new Error('ffprobe exploded')));
    try {
      const run = await finished(runs, service.start().id);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(run.status).toBe('completed');
      expect(run.errorSummary).toBeNull();
      expect(credits.runPending).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalled();
    } finally { error.mockRestore(); db.close(); }
  });
});
