import Database from 'better-sqlite3';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../db/db.js';
import { backupsDir } from '../db/backupFile.js';
import { RESTORE_MARKER } from '../db/restorePending.js';
import { BackupRepository } from '../repositories/backupRepository.js';
import { BackupService } from './backupService.js';

const directories: string[] = [];
const databases: Database.Database[] = [];
afterEach(() => {
  databases.splice(0).forEach((db) => db.close());
  directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true }));
});

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'ottlib-backups-')); directories.push(dir);
  const db = createDatabase(dir); databases.push(db);
  let tick = 0;
  const service = new BackupService(new BackupRepository(db), dir, () => new Date(2026, 10, 10, 4, 0, tick++));
  return { dir, db, service, backups: backupsDir(dir) };
}

function touch(dir: string, name: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), 'x');
}

describe('BackupService', () => {
  it('creates a manual backup that opens as SQLite with the library tables', () => {
    const { service, backups } = fixture();
    const made = service.create('manual');
    expect(made.kind).toBe('manual');
    expect(made.name).toMatch(/^manual-\d{8}-\d{6}\.sqlite$/);
    const copy = new Database(join(backups, made.name), { readonly: true });
    expect(copy.prepare("SELECT name FROM sqlite_master WHERE name = 'movies'").get()).toBeTruthy();
    copy.close();
    expect(service.list().map((backup) => backup.name)).toEqual([made.name]);
  });

  it('lists newest first across kinds and ignores other files', () => {
    const { service, backups } = fixture();
    touch(backups, 'daily-20261101-040000.sqlite');
    touch(backups, 'manual-20261105-100000.sqlite');
    touch(backups, 'notes.txt');
    expect(service.list().map((backup) => `${backup.kind}:${backup.name}`)).toEqual([
      'manual:manual-20261105-100000.sqlite',
      'daily:daily-20261101-040000.sqlite'
    ]);
  });

  it('rejects names outside the backup pattern', () => {
    const { service } = fixture();
    for (const name of ['../library.sqlite', 'daily-1.sqlite', 'library.sqlite', 'manual-20261110-040000.sqlite/../x']) {
      expect(() => service.remove(name)).toThrow('Invalid backup name');
      expect(() => service.requestRestore(name)).toThrow('Invalid backup name');
    }
  });

  it('removes a backup and reports a missing one', () => {
    const { service, backups } = fixture();
    touch(backups, 'manual-20261105-100000.sqlite');
    service.remove('manual-20261105-100000.sqlite');
    expect(service.list()).toEqual([]);
    expect(() => service.remove('manual-20261105-100000.sqlite')).toThrow('Backup not found');
  });

  it('prunes to 3 pre-update and 7 daily and keeps every manual and before-restore backup', () => {
    const { service, backups } = fixture();
    for (let day = 1; day <= 10; day++) touch(backups, `daily-202611${String(day).padStart(2, '0')}-040000.sqlite`);
    for (let day = 1; day <= 5; day++) touch(backups, `pre-update-202611${String(day).padStart(2, '0')}-040000.sqlite`);
    for (let day = 1; day <= 12; day++) touch(backups, `manual-202611${String(day).padStart(2, '0')}-040000.sqlite`);
    touch(backups, 'before-restore-20261101-040000.sqlite');
    touch(backups, 'before-restore-20261102-040000.sqlite');
    service.prune();
    const names = service.list().map((backup) => backup.name);
    expect(names.filter((name) => name.startsWith('daily-'))).toHaveLength(7);
    expect(names).not.toContain('daily-20261103-040000.sqlite');
    expect(names).toContain('daily-20261104-040000.sqlite');
    expect(names.filter((name) => name.startsWith('pre-update-'))).toEqual(['pre-update-20261105-040000.sqlite', 'pre-update-20261104-040000.sqlite', 'pre-update-20261103-040000.sqlite']);
    expect(names.filter((name) => name.startsWith('manual-'))).toHaveLength(12);
    expect(names.filter((name) => name.startsWith('before-restore-'))).toHaveLength(2);
  });

  it('prunes after creating a daily backup', () => {
    const { service, backups } = fixture();
    for (let day = 1; day <= 7; day++) touch(backups, `daily-202611${String(day).padStart(2, '0')}-030000.sqlite`);
    service.create('daily');
    expect(service.list().filter((backup) => backup.kind === 'daily')).toHaveLength(7);
    expect(existsSync(join(backups, 'daily-20261101-030000.sqlite'))).toBe(false);
  });

  it('writes the restore marker for a healthy backup', () => {
    const { service, dir } = fixture();
    const made = service.create('manual');
    service.requestRestore(made.name);
    expect(JSON.parse(readFileSync(join(dir, RESTORE_MARKER), 'utf8'))).toEqual({ name: made.name });
  });

  it('refuses to restore a file that is not a database or has no movies table', () => {
    const { service, dir, backups } = fixture();
    touch(backups, 'manual-20261105-100000.sqlite');
    expect(() => service.requestRestore('manual-20261105-100000.sqlite')).toThrow(/backup/i);
    const empty = new Database(join(backups, 'manual-20261106-100000.sqlite'));
    empty.exec('CREATE TABLE other (id INTEGER)');
    empty.close();
    expect(() => service.requestRestore('manual-20261106-100000.sqlite')).toThrow('no movies table');
    expect(existsSync(join(dir, RESTORE_MARKER))).toBe(false);
  });

  it('remembers the latest daily outcome', () => {
    const { dir, db } = fixture();
    const failing = new BackupRepository(db);
    let fail = true;
    failing.writeCopy = () => { if (fail) throw new Error('disk full'); };
    const service = new BackupService(failing, dir, () => new Date(2026, 10, 10, 4, 0, 0));
    expect(service.lastDailyResult()).toBeNull();
    expect(() => service.create('daily')).toThrow('disk full');
    expect(service.lastDailyResult()).toMatchObject({ ok: false, error: 'disk full' });
    fail = false;
    touch(backupsDir(dir), 'daily-20261110-040000.sqlite');
    service.create('daily');
    expect(service.lastDailyResult()).toMatchObject({ ok: true });
    expect(service.lastDailyResult()?.error).toBeUndefined();
  });

  it('does not record manual failures as daily ones', () => {
    const { dir, db } = fixture();
    const failing = new BackupRepository(db);
    failing.writeCopy = () => { throw new Error('boom'); };
    const service = new BackupService(failing, dir);
    expect(() => service.create('manual')).toThrow('boom');
    expect(service.lastDailyResult()).toBeNull();
  });
});
