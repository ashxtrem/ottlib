import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { createDatabase } from '../db/db.js';

const directories: string[] = [];

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'ottlib-profile-routes-')); directories.push(directory);
  mkdirSync(join(directory, 'posters'), { recursive: true });
  const db = createDatabase(directory);
  return { app: buildApp(db, directory, 0), db };
}

afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })));

type App = ReturnType<typeof fixture>['app'];
const session = (token: string) => ({ 'x-profile-session': token });
const ownerId = async (app: App) => ((await app.inject({ method: 'GET', url: '/api/profiles' })).json() as { id: number; isOwner: boolean }[]).find((p) => p.isOwner)!.id;
async function select(app: App, id: number, pin?: string) {
  return app.inject({ method: 'POST', url: `/api/profiles/${id}/select`, payload: pin ? { pin } : {} });
}

describe('profile routes', () => {
  it('resolves the only PIN-less profile without a session, and asks for a profile once there are two', async () => {
    const { app, db } = fixture();
    try {
      const me = await app.inject({ method: 'GET', url: '/api/profiles/me' });
      expect(me.statusCode).toBe(200);
      expect(me.json()).toEqual({ profile: { id: await ownerId(app), name: 'Home', color: '#e50914', hasPin: false, isOwner: true } });

      const created = await app.inject({ method: 'POST', url: '/api/profiles', payload: { name: '  Kid  ', color: '#17c964', pin: '1234' } });
      expect(created.statusCode).toBe(201);
      expect(created.json()).toMatchObject({ name: 'Kid', hasPin: true, isOwner: false });

      const required = await app.inject({ method: 'GET', url: '/api/profiles/me' });
      expect(required.statusCode).toBe(409);
      expect(required.json().error).toBe('PROFILE_REQUIRED');
      expect((await app.inject({ method: 'GET', url: '/api/profiles/me', headers: session('unknown') })).statusCode).toBe(409);
    } finally { await app.close(); db.close(); }
  });

  it('selects with the right PIN, throttles wrong ones, and deselects', async () => {
    const { app, db } = fixture();
    try {
      const kid = (await app.inject({ method: 'POST', url: '/api/profiles', payload: { name: 'Kid', color: '#17c964', pin: '1234' } })).json();
      expect((await select(app, kid.id)).statusCode).toBe(401);
      for (let attempt = 1; attempt < 5; attempt++) expect((await select(app, kid.id, '0000')).statusCode).toBe(401);
      const locked = await select(app, kid.id, '1234');
      expect(locked.statusCode).toBe(429);
      expect(locked.json().error).toMatch(/Try again in \d+ seconds/);

      const remote = await app.inject({ method: 'POST', url: `/api/profiles/${kid.id}/select`, payload: { pin: '1234' }, remoteAddress: '192.168.1.20' });
      expect(remote.statusCode).toBe(200);
      const { token, profile } = remote.json();
      expect(profile).toMatchObject({ id: kid.id, name: 'Kid' });
      expect((await app.inject({ method: 'GET', url: '/api/profiles/me', headers: session(token) })).json().profile.id).toBe(kid.id);

      expect((await app.inject({ method: 'POST', url: '/api/profiles/deselect', headers: session(token) })).statusCode).toBe(204);
      expect((await app.inject({ method: 'GET', url: '/api/profiles/me', headers: session(token) })).statusCode).toBe(409);
      expect((await app.inject({ method: 'POST', url: '/api/profiles/999/select', payload: {} })).statusCode).toBe(404);
    } finally { await app.close(); db.close(); }
  });

  it('keeps creating, deleting and other people\'s PINs to the owner', async () => {
    const { app, db } = fixture();
    try {
      const owner = await ownerId(app);
      const kid = (await app.inject({ method: 'POST', url: '/api/profiles', payload: { name: 'Kid', color: '#17c964', pin: '1234' } })).json();
      const ownerToken = (await select(app, owner)).json().token as string;
      const kidToken = (await select(app, kid.id, '1234')).json().token as string;

      expect((await app.inject({ method: 'POST', url: '/api/profiles', headers: session(kidToken), payload: { name: 'X', color: '#17c964' } })).statusCode).toBe(403);
      expect((await app.inject({ method: 'DELETE', url: `/api/profiles/${owner}`, headers: session(kidToken) })).statusCode).toBe(403);
      expect((await app.inject({ method: 'DELETE', url: `/api/profiles/${owner}`, headers: session(ownerToken) })).statusCode).toBe(403);
      const taken = await app.inject({ method: 'POST', url: '/api/profiles', headers: session(ownerToken), payload: { name: 'KID', color: '#17c964' } });
      expect(taken.statusCode).toBe(409);
      expect(taken.json().error).toBe('PROFILE_NAME_TAKEN');
      expect((await app.inject({ method: 'POST', url: '/api/profiles', headers: session(ownerToken), payload: { name: 'X', color: 'red' } })).statusCode).toBe(400);
      for (const name of ['A', 'B', 'C', 'D']) expect((await app.inject({ method: 'POST', url: '/api/profiles', headers: session(ownerToken), payload: { name, color: '#006fee' } })).statusCode).toBe(201);
      const limit = await app.inject({ method: 'POST', url: '/api/profiles', headers: session(ownerToken), payload: { name: 'Seventh', color: '#006fee' } });
      expect(limit.statusCode).toBe(409);
      expect(limit.json().error).toBe('PROFILE_LIMIT');

      // A non-owner changing its own PIN needs the current one; the owner clears it without.
      expect((await app.inject({ method: 'PUT', url: `/api/profiles/${kid.id}/pin`, headers: session(kidToken), payload: { pin: '5678' } })).statusCode).toBe(401);
      expect((await app.inject({ method: 'PUT', url: `/api/profiles/${kid.id}/pin`, headers: session(kidToken), payload: { currentPin: '1234', pin: '5678' } })).statusCode).toBe(200);
      expect((await app.inject({ method: 'PUT', url: `/api/profiles/${kid.id}/pin`, headers: session(kidToken), payload: { currentPin: '5678', pin: '12' } })).statusCode).toBe(400);
      const cleared = await app.inject({ method: 'PUT', url: `/api/profiles/${kid.id}/pin`, headers: session(ownerToken), payload: { pin: null } });
      expect(cleared.statusCode).toBe(200);
      expect(cleared.json().hasPin).toBe(false);

      expect((await app.inject({ method: 'PATCH', url: `/api/profiles/${kid.id}`, headers: session(kidToken), payload: { name: 'Kiddo', color: '#f31260' } })).json()).toMatchObject({ name: 'Kiddo', color: '#f31260' });
      expect((await app.inject({ method: 'PATCH', url: `/api/profiles/${owner}`, headers: session(kidToken), payload: { name: 'Mine' } })).statusCode).toBe(403);

      expect((await app.inject({ method: 'DELETE', url: `/api/profiles/${kid.id}`, headers: session(ownerToken) })).statusCode).toBe(204);
      expect((await app.inject({ method: 'GET', url: '/api/profiles/me', headers: session(kidToken) })).statusCode).toBe(409);
    } finally { await app.close(); db.close(); }
  });

  it('resets the owner and access PINs only from the server machine, even when the access PIN is forgotten', async () => {
    const { app, db } = fixture();
    try {
      const owner = await ownerId(app);
      expect((await app.inject({ method: 'PUT', url: `/api/profiles/${owner}/pin`, payload: { pin: '4321' } })).statusCode).toBe(200);
      expect((await app.inject({ method: 'PUT', url: '/api/auth/pin', payload: { newPin: '1357' } })).statusCode).toBe(200);
      expect((await app.inject({ method: 'GET', url: '/api/profiles' })).statusCode).toBe(401);

      expect((await app.inject({ method: 'POST', url: '/api/profiles/reset-local', remoteAddress: '192.168.1.20' })).statusCode).toBe(403);
      const reset = await app.inject({ method: 'POST', url: '/api/profiles/reset-local' });
      expect(reset.statusCode).toBe(200);
      expect(reset.json()).toEqual({ ownerPinCleared: true, accessPinCleared: true });

      expect((await app.inject({ method: 'GET', url: '/api/auth/status' })).json()).toEqual({ pinEnabled: false, authenticated: true });
      expect((await app.inject({ method: 'GET', url: '/api/profiles/me' })).json().profile).toMatchObject({ id: owner, hasPin: false });
    } finally { await app.close(); db.close(); }
  });
});
