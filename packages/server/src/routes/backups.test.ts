import Database from 'better-sqlite3';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { backupListSchema, backupSchema } from '@ottlib/shared';
import { buildApp } from '../app.js';
import { createDatabase } from '../db/db.js';
import { backupsDir } from '../db/backupFile.js';
import { RESTORE_MARKER } from '../db/restorePending.js';

const directories: string[] = [];
const closers: Array<() => Promise<unknown> | void> = [];
afterEach(async () => {
  for (const close of closers.splice(0)) await close();
  directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true }));
});

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'ottlib-backup-routes-')); directories.push(dir);
  const db = createDatabase(dir);
  const app = buildApp(db, dir, 0);
  closers.push(() => app.close(), async () => { db.close(); });
  return { app, dir };
}

describe('backup routes', () => {
  it('POST /api/backups creates a file that opens as SQLite, and GET lists it', async () => {
    const { app, dir } = fixture();
    const created = await app.inject({ method: 'POST', url: '/api/backups' });
    expect(created.statusCode).toBe(200);
    const backup = backupSchema.parse(created.json());
    expect(backup.kind).toBe('manual');
    const copy = new Database(join(backupsDir(dir), backup.name), { readonly: true });
    expect(copy.pragma('quick_check', { simple: true })).toBe('ok');
    copy.close();
    const listed = await app.inject({ method: 'GET', url: '/api/backups' });
    expect(backupListSchema.parse(listed.json()).map((item) => item.name)).toEqual([backup.name]);
  });

  it('answers a bad name with 400', async () => {
    const { app } = fixture();
    expect((await app.inject({ method: 'DELETE', url: '/api/backups/library.sqlite' })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/backups/not-a-backup/restore' })).statusCode).toBe(400);
    expect((await app.inject({ method: 'DELETE', url: '/api/backups/manual-20261110-040000.sqlite' })).statusCode).toBe(400);
  });

  it('deletes a backup', async () => {
    const { app, dir } = fixture();
    const backup = backupSchema.parse((await app.inject({ method: 'POST', url: '/api/backups' })).json());
    expect((await app.inject({ method: 'DELETE', url: `/api/backups/${backup.name}` })).statusCode).toBe(204);
    expect(existsSync(join(backupsDir(dir), backup.name))).toBe(false);
  });

  it('restore answers pending-restart from loopback and writes the marker', async () => {
    const { app, dir } = fixture();
    const backup = backupSchema.parse((await app.inject({ method: 'POST', url: '/api/backups' })).json());
    const response = await app.inject({ method: 'POST', url: `/api/backups/${backup.name}/restore` });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'pending-restart' });
    expect(existsSync(join(dir, RESTORE_MARKER))).toBe(true);
  });

  it('restore from a non-loopback address is a 403 and writes nothing', async () => {
    const { app, dir } = fixture();
    const backup = backupSchema.parse((await app.inject({ method: 'POST', url: '/api/backups' })).json());
    const response = await app.inject({ method: 'POST', url: `/api/backups/${backup.name}/restore`, remoteAddress: '192.168.1.20' });
    expect(response.statusCode).toBe(403);
    expect(existsSync(join(dir, RESTORE_MARKER))).toBe(false);
  });
});
