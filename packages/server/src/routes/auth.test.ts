import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { createDatabase } from '../db/db.js';

const directories: string[] = [];

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'ottlib-auth-routes-')); directories.push(directory);
  mkdirSync(join(directory, 'posters'), { recursive: true });
  const db = createDatabase(directory);
  return { app: buildApp(db, directory, 0), db };
}

const cookieFrom = (setCookie: string | string[] | undefined) => String(Array.isArray(setCookie) ? setCookie[0] : setCookie).split(';')[0];

afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })));

describe('access PIN', () => {
  it('leaves everything open until a PIN is set', async () => {
    const { app, db } = fixture();
    try {
      expect((await app.inject({ method: 'GET', url: '/api/auth/status' })).json()).toEqual({ pinEnabled: false, authenticated: true });
      expect((await app.inject({ method: 'GET', url: '/api/settings' })).statusCode).toBe(200);
    } finally { await app.close(); db.close(); }
  });

  it('guards API and media routes, and signs in with a cookie', async () => {
    const { app, db } = fixture();
    try {
      const set = await app.inject({ method: 'PUT', url: '/api/auth/pin', payload: { newPin: '1357' } });
      expect(set.statusCode).toBe(200);
      const ownerCookie = cookieFrom(set.headers['set-cookie']);
      expect(ownerCookie).toMatch(/^ottlib_session=.+/);
      expect((await app.inject({ method: 'GET', url: '/api/settings', headers: { cookie: ownerCookie } })).statusCode).toBe(200);

      for (const url of ['/api/settings', '/api/movies', '/media/posters/x.jpg', '/api/%73ettings']) expect((await app.inject({ method: 'GET', url })).statusCode, url).toBe(401);
      expect((await app.inject({ method: 'GET', url: '/api/server-info' })).statusCode).toBe(200);

      const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { pin: '1357' } });
      expect(login.statusCode).toBe(200);
      const cookie = cookieFrom(login.headers['set-cookie']);
      expect((await app.inject({ method: 'GET', url: '/api/auth/status', headers: { cookie } })).json()).toEqual({ pinEnabled: true, authenticated: true });

      expect((await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie } })).statusCode).toBe(204);
      expect((await app.inject({ method: 'GET', url: '/api/settings', headers: { cookie } })).statusCode).toBe(401);
    } finally { await app.close(); db.close(); }
  });

  it('needs the current PIN to change or remove it, and signs other devices out', async () => {
    const { app, db } = fixture();
    try {
      const owner = cookieFrom((await app.inject({ method: 'PUT', url: '/api/auth/pin', payload: { newPin: '1357' } })).headers['set-cookie']);
      const other = cookieFrom((await app.inject({ method: 'POST', url: '/api/auth/login', payload: { pin: '1357' } })).headers['set-cookie']);

      expect((await app.inject({ method: 'PUT', url: '/api/auth/pin', headers: { cookie: owner }, payload: { currentPin: '0000', newPin: '2468' } })).statusCode).toBe(401);
      const changed = await app.inject({ method: 'PUT', url: '/api/auth/pin', headers: { cookie: owner }, payload: { currentPin: '1357', newPin: '2468' } });
      expect(changed.statusCode).toBe(200);
      const fresh = cookieFrom(changed.headers['set-cookie']);
      expect((await app.inject({ method: 'GET', url: '/api/settings', headers: { cookie: other } })).statusCode).toBe(401);
      expect((await app.inject({ method: 'GET', url: '/api/settings', headers: { cookie: fresh } })).statusCode).toBe(200);

      expect((await app.inject({ method: 'POST', url: '/api/auth/pin/remove', headers: { cookie: fresh }, payload: { currentPin: '2468' } })).statusCode).toBe(204);
      expect((await app.inject({ method: 'GET', url: '/api/settings' })).statusCode).toBe(200);
    } finally { await app.close(); db.close(); }
  });

  it('rejects PINs that are not 4 to 8 digits', async () => {
    const { app, db } = fixture();
    try {
      for (const newPin of ['123', '123456789', '12ab']) expect((await app.inject({ method: 'PUT', url: '/api/auth/pin', payload: { newPin } })).statusCode).toBe(400);
    } finally { await app.close(); db.close(); }
  });

  it('locks a client out after repeated wrong PINs', async () => {
    const { app, db } = fixture();
    try {
      await app.inject({ method: 'PUT', url: '/api/auth/pin', payload: { newPin: '1357' } });
      for (let attempt = 0; attempt < 5; attempt++) expect((await app.inject({ method: 'POST', url: '/api/auth/login', payload: { pin: '0000' } })).statusCode).toBe(401);
      const locked = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { pin: '1357' } });
      expect(locked.statusCode).toBe(429);
      expect(locked.json().error).toMatch(/Try again in \d+ seconds/);
    } finally { await app.close(); db.close(); }
  });
});

describe('torrent search toggle', () => {
  it('answers 404 on torrent routes until switched on', async () => {
    const { app, db } = fixture();
    try {
      expect((await app.inject({ method: 'GET', url: '/api/settings' })).json().torrentSearchEnabled).toBe(false);
      expect((await app.inject({ method: 'GET', url: '/api/torrents/connection' })).statusCode).toBe(404);
      await app.inject({ method: 'PUT', url: '/api/settings', payload: { torrentSearchEnabled: true } });
      expect((await app.inject({ method: 'GET', url: '/api/torrents/connection' })).json()).toMatchObject({ status: 'not-configured' });
    } finally { await app.close(); db.close(); }
  });
});
