import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app.js';
import { createDatabase } from '../db/db.js';

const directories: string[] = [];

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'ottlib-media-static-')); directories.push(directory);
  const db = createDatabase(directory);
  mkdirSync(join(directory, 'posters'), { recursive: true }); mkdirSync(join(directory, 'backdrops'), { recursive: true });
  writeFileSync(join(directory, 'posters', 'x.jpg'), 'poster-bytes'); writeFileSync(join(directory, 'posters', 'notes.txt'), 'secret notes');
  writeFileSync(join(directory, 'posters', 'UP.PNG'), 'upper'); writeFileSync(join(directory, 'posters', '.hidden.jpg'), 'hidden');
  writeFileSync(join(directory, 'backdrops', 'y.webp'), 'backdrop-bytes');
  return { app: buildApp(db, directory, 0), db, directory };
}

const cookieFrom = (setCookie: string | string[] | undefined) => String(Array.isArray(setCookie) ? setCookie[0] : setCookie).split(';')[0];
const DATABASE_URLS = ['/media/library.sqlite', '/media/library.sqlite-wal', '/media/library.sqlite-shm', '/media/./library.sqlite', '/media//library.sqlite', '/media/LIBRARY.SQLITE', '/media/posters/../library.sqlite', '/media/posters/..%2flibrary.sqlite', '/media/posters/..%5clibrary.sqlite', '/media/%2e%2e/library.sqlite'];

afterEach(() => { vi.restoreAllMocks(); directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })); });

async function expectDatabaseHidden(app: ReturnType<typeof fixture>['app'], headers: Record<string, string>) {
  for (const url of DATABASE_URLS) {
    const response = await app.inject({ method: 'GET', url, headers });
    expect(response.statusCode, url).not.toBe(200);
    expect([400, 404], url).toContain(response.statusCode);
    expect(response.body.startsWith('SQLite format 3'), url).toBe(false);
  }
}

describe('/media static files', () => {
  it('serves artwork only, never the database, with no PIN', async () => {
    const { app, db } = fixture();
    try {
      await expectDatabaseHidden(app, {});
      const poster = await app.inject({ method: 'GET', url: '/media/posters/x.jpg' });
      expect(poster.statusCode).toBe(200); expect(poster.body).toBe('poster-bytes');
      expect((await app.inject({ method: 'GET', url: '/media/backdrops/y.webp' })).statusCode).toBe(200);
      expect((await app.inject({ method: 'GET', url: '/media/posters/UP.PNG' })).statusCode).toBe(200);
      for (const url of ['/media/posters/notes.txt', '/media/posters/.hidden.jpg', '/media/posters/', '/media/posters', '/media/backdrops/x.jpg', '/media/', '/media/other/x.jpg']) expect((await app.inject({ method: 'GET', url })).statusCode, url).toBe(404);
    } finally { await app.close(); db.close(); }
  });

  it('keeps artwork behind the PIN and hides the database with a valid session', async () => {
    const { app, db } = fixture();
    try {
      const cookie = cookieFrom((await app.inject({ method: 'PUT', url: '/api/auth/pin', payload: { newPin: '1357' } })).headers['set-cookie']);
      expect((await app.inject({ method: 'GET', url: '/media/posters/x.jpg' })).statusCode).toBe(401);
      expect((await app.inject({ method: 'GET', url: '/media/backdrops/y.webp' })).statusCode).toBe(401);
      await expectDatabaseHidden(app, { cookie });
      expect((await app.inject({ method: 'GET', url: '/media/posters/x.jpg', headers: { cookie } })).statusCode).toBe(200);
      expect((await app.inject({ method: 'GET', url: '/media/backdrops/y.webp', headers: { cookie } })).statusCode).toBe(200);
      expect((await app.inject({ method: 'GET', url: '/media/posters/notes.txt', headers: { cookie } })).statusCode).toBe(404);
    } finally { await app.close(); db.close(); }
  });

  it('answers unknown /media paths with JSON 404 even when the web app is built, and still serves the web app', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'ottlib-media-static-cwd-')); directories.push(cwd);
    mkdirSync(join(cwd, 'packages', 'client', 'dist'), { recursive: true }); writeFileSync(join(cwd, 'packages', 'client', 'dist', 'index.html'), '<html>app</html>');
    vi.spyOn(process, 'cwd').mockReturnValue(cwd);
    const { app, db } = fixture();
    try {
      for (const url of ['/media/library.sqlite', '/media/posters/notes.txt', '/media/nope', '/api/nope']) {
        const response = await app.inject({ method: 'GET', url });
        expect(response.statusCode, url).toBe(404); expect(response.json(), url).toEqual({ error: 'Not found' });
      }
      expect((await app.inject({ method: 'GET', url: '/media/posters/x.jpg' })).statusCode).toBe(200);
      const page = await app.inject({ method: 'GET', url: '/some/page' });
      expect(page.statusCode).toBe(200); expect(page.body).toContain('app');
      expect((await app.inject({ method: 'GET', url: '/' })).body).toContain('app');
    } finally { await app.close(); db.close(); }
  });
});
