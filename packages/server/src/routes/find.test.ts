import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { findHandoffResultSchema, findStatusSchema } from '@ottlib/shared';
import { buildApp } from '../app.js';
import { createDatabase } from '../db/db.js';
import { HashlarkLink } from '../providers/find/hashlarkLink.js';
import { SettingRepository } from '../repositories/settingRepository.js';

const directories: string[] = [];
const closers: Array<() => Promise<unknown> | void> = [];
afterEach(async () => {
  for (const close of closers.splice(0)) await close();
  directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true }));
});

/** A real HashlarkLink with a fake spawner and registry probe: nothing is ever launched. */
function fixture(options: { installed: boolean; mode: 'off' | 'qbittorrent' | 'hashlark' }) {
  const dir = mkdtempSync(join(tmpdir(), 'ottlib-find-routes-')); directories.push(dir);
  const db = createDatabase(dir);
  const unref = vi.fn(); const spawn = vi.fn(() => ({ unref }));
  const probe = () => { if (!options.installed) throw new Error('exit 1'); };
  const app = buildApp(db, dir, 0, { findHandoff: new HashlarkLink(spawn, probe, 'win32') });
  new SettingRepository(db).update({ torrentSearchEnabled: options.mode !== 'off', findProvider: options.mode === 'hashlark' ? 'hashlark' : 'qbittorrent' });
  closers.push(() => app.close(), async () => { db.close(); });
  return { app, spawn, unref };
}

const post = (app: ReturnType<typeof buildApp>, payload: unknown) => app.inject({ method: 'POST', url: '/api/find/handoff', payload: payload as object });

describe('find routes', () => {
  it('POST /api/find/handoff opens Hashlark once with the encoded link and no shell', async () => {
    const { app, spawn, unref } = fixture({ installed: true, mode: 'hashlark' });
    const response = await post(app, { title: 'Tom & Jerry', year: 2021, imdbId: 'tt0133093' });
    expect(response.statusCode).toBe(200);
    expect(findHandoffResultSchema.parse(response.json())).toEqual({ app: 'hashlark' });
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(spawn).toHaveBeenCalledWith('rundll32.exe', ['url.dll,FileProtocolHandler', 'hashlark://search?q=Tom%20%26%20Jerry%202021&cat=movies&imdb=tt0133093'], { detached: true, stdio: 'ignore', windowsHide: true });
    expect(unref).toHaveBeenCalledTimes(1);
  });

  it('answers 409 HASHLARK_NOT_FOUND when the link is not registered', async () => {
    const { app, spawn } = fixture({ installed: false, mode: 'hashlark' });
    const response = await post(app, { title: 'Heat' });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: 'HASHLARK_NOT_FOUND', message: "Hashlark isn't installed on the server PC." });
    expect(spawn).not.toHaveBeenCalled();
  });

  it('answers 404 while Find is off or set to qBittorrent', async () => {
    for (const mode of ['off', 'qbittorrent'] as const) {
      const { app, spawn } = fixture({ installed: true, mode });
      expect((await post(app, { title: 'Heat' })).statusCode).toBe(404);
      expect(spawn).not.toHaveBeenCalled();
    }
  });

  it('rejects a bad imdbId, an empty or oversized title and a stray url with 400', async () => {
    const { app, spawn } = fixture({ installed: true, mode: 'hashlark' });
    expect((await post(app, { title: 'Heat', imdbId: 'nm0000001' })).statusCode).toBe(400);
    expect((await post(app, { title: 'Heat', imdbId: 'tt123' })).statusCode).toBe(400);
    expect((await post(app, { title: '' })).statusCode).toBe(400);
    expect((await post(app, { title: 'a'.repeat(201) })).statusCode).toBe(400);
    expect((await post(app, { title: 'Heat', year: 'x' })).statusCode).toBe(400);
    expect(spawn).not.toHaveBeenCalled();
  });

  it('opens the app with no query when the body is empty', async () => {
    const { app, spawn } = fixture({ installed: true, mode: 'hashlark' });
    expect((await post(app, {})).statusCode).toBe(200);
    expect(spawn).toHaveBeenCalledWith('rundll32.exe', ['url.dll,FileProtocolHandler', 'hashlark://search'], expect.anything());
  });

  it('GET /api/find/status is always on', async () => {
    for (const [mode, installed] of [['off', false], ['qbittorrent', true], ['hashlark', true], ['hashlark', false]] as const) {
      const { app } = fixture({ installed, mode });
      const response = await app.inject({ method: 'GET', url: '/api/find/status' });
      expect(response.statusCode).toBe(200);
      expect(findStatusSchema.parse(response.json())).toEqual({ mode, hashlarkAvailable: installed });
    }
  });

  it('/api/server-info carries findHandoff: hashlark only in Hashlark mode', async () => {
    for (const [mode, expected] of [['off', null], ['qbittorrent', null], ['hashlark', 'hashlark']] as const) {
      const { app } = fixture({ installed: true, mode });
      expect((await app.inject({ method: 'GET', url: '/api/server-info' })).json().findHandoff).toBe(expected);
    }
  });

  it('is behind the access PIN like the other routes', async () => {
    const { app } = fixture({ installed: true, mode: 'hashlark' });
    await app.inject({ method: 'PUT', url: '/api/auth/pin', payload: { newPin: '1357' } });
    expect((await app.inject({ method: 'GET', url: '/api/find/status' })).statusCode).toBe(401);
    expect((await post(app, { title: 'Heat' })).statusCode).toBe(401);
  });
});
