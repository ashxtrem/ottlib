import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { healthReportSchema } from '@ottlib/shared';
import { buildApp } from '../app.js';
import { createDatabase } from '../db/db.js';
import { FfmpegLocator } from '../providers/transcode/ffmpegLocator.js';
import { FolderRepository } from '../repositories/folderRepository.js';
import { SettingRepository } from '../repositories/settingRepository.js';

const directories: string[] = [];
const closers: Array<() => Promise<unknown> | void> = [];
afterEach(async () => {
  for (const close of closers.splice(0)) await close();
  directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true }));
});

/** No ffmpeg, no TMDb key, no VERSION in the test's working directory: nothing reaches the network. */
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'ottlib-health-routes-')); directories.push(dir);
  const db = createDatabase(dir);
  const app = buildApp(db, dir, 0, { ffmpeg: new FfmpegLocator(async () => { throw new Error('no ffmpeg'); }) });
  closers.push(() => app.close(), async () => { db.close(); });
  return { app, db, dir };
}

const get = async (app: ReturnType<typeof buildApp>, url: string) => {
  const response = await app.inject({ method: 'GET', url });
  expect(response.statusCode).toBe(200);
  return healthReportSchema.parse(response.json());
};

describe('health routes', () => {
  it('GET /api/health lists every registered check with a state', async () => {
    const { app, db, dir } = fixture();
    new FolderRepository(db).create(join(dir, 'missing-movies'));
    const report = await get(app, '/api/health');
    expect(report.checks.map((check) => check.id)).toEqual(['library-folders', 'disk-space', 'ffmpeg', 'tmdb-key', 'backups', 'update']);
    const byId = Object.fromEntries(report.checks.map((check) => [check.id, check]));
    expect(byId['library-folders']).toMatchObject({ state: 'fail' });
    expect(byId['library-folders'].message).toContain('missing-movies');
    expect(byId.ffmpeg.state).toBe('warn');
    expect(byId['tmdb-key'].state).toBe('warn');
    expect(byId.update).toMatchObject({ state: 'ok', message: 'Running from source.' });
  });

  it('includes qbittorrent only while torrent search is on', async () => {
    const { app, db } = fixture();
    new SettingRepository(db).update({ torrentSearchEnabled: true });
    const report = await get(app, '/api/health');
    expect(report.checks.find((check) => check.id === 'qbittorrent')).toMatchObject({ state: 'fail' });
  });

  it('answers a second call from the cache; ?fresh=1 runs the checks again', async () => {
    const { app } = fixture();
    const first = await get(app, '/api/health');
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect((await get(app, '/api/health')).checkedAt).toBe(first.checkedAt);
    expect((await get(app, '/api/health?fresh=1')).checkedAt).not.toBe(first.checkedAt);
  });
});
