import Database from 'better-sqlite3';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { backupsDir } from './backupFile.js';
import { applyPendingRestore } from './restorePending.js';

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })));

function makeDb(path: string, value: string): void {
  const db = new Database(path);
  db.exec('CREATE TABLE t (v TEXT)');
  db.prepare('INSERT INTO t VALUES (?)').run(value);
  db.close();
}
const valueOf = (path: string) => { const db = new Database(path, { readonly: true }); const row = db.prepare('SELECT v FROM t').get() as { v: string }; db.close(); return row.v; };

function setup(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ottlib-restore-')); directories.push(dir);
  makeDb(join(dir, 'library.sqlite'), 'live');
  mkdirSync(backupsDir(dir), { recursive: true });
  makeDb(join(backupsDir(dir), 'manual-20260101-120000.sqlite'), 'backup');
  return dir;
}
const mark = (dir: string, content: unknown) => writeFileSync(join(dir, 'restore-pending.json'), typeof content === 'string' ? content : JSON.stringify(content));

describe('applyPendingRestore', () => {
  it('does nothing without a marker', () => {
    const dir = setup();
    expect(applyPendingRestore(dir)).toBeNull();
    expect(valueOf(join(dir, 'library.sqlite'))).toBe('live');
  });

  it('swaps in the chosen backup, keeps the old database as one before-restore-* file, and deletes the marker', () => {
    const dir = setup();
    writeFileSync(join(dir, 'library.sqlite-wal'), 'wal'); writeFileSync(join(dir, 'library.sqlite-shm'), 'shm');
    mark(dir, { name: 'manual-20260101-120000.sqlite' });
    expect(applyPendingRestore(dir, new Date(2026, 5, 7, 8, 9, 10))).toBe('manual-20260101-120000.sqlite');
    expect(valueOf(join(dir, 'library.sqlite'))).toBe('backup');
    expect(existsSync(join(dir, 'restore-pending.json'))).toBe(false);
    expect(existsSync(join(dir, 'library.sqlite-wal'))).toBe(false);
    expect(existsSync(join(dir, 'library.sqlite-shm'))).toBe(false);
    expect(readdirSync(backupsDir(dir)).sort()).toEqual(['before-restore-20260607-080910.sqlite', 'manual-20260101-120000.sqlite']);
    expect(valueOf(join(backupsDir(dir), 'before-restore-20260607-080910.sqlite'))).toBe('live');
  });

  it('folds uncheckpointed wal content into the kept before-restore-* file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ottlib-restore-')); directories.push(dir);
    mkdirSync(backupsDir(dir), { recursive: true });
    makeDb(join(backupsDir(dir), 'manual-20260101-120000.sqlite'), 'backup');
    const live = join(dir, 'library.sqlite');
    const db = new Database(live);
    db.pragma('journal_mode = WAL'); db.pragma('wal_autocheckpoint = 0');
    db.exec('CREATE TABLE t (v TEXT)'); db.prepare('INSERT INTO t VALUES (?)').run('in-wal');
    // Closing would checkpoint, so copy the files while the connection is open: the row exists only in the wal.
    for (const suffix of ['', '-wal', '-shm']) copyFileSync(live + suffix, join(dir, 'copy.sqlite') + suffix);
    db.close();
    rmSync(live, { force: true }); rmSync(live + '-wal', { force: true }); rmSync(live + '-shm', { force: true });
    for (const suffix of ['', '-wal', '-shm']) copyFileSync(join(dir, 'copy.sqlite') + suffix, live + suffix);
    expect(statSync(live + '-wal').size).toBeGreaterThan(0);
    mark(dir, { name: 'manual-20260101-120000.sqlite' });
    expect(applyPendingRestore(dir, new Date(2026, 5, 7, 8, 9, 10))).toBe('manual-20260101-120000.sqlite');
    expect(readdirSync(backupsDir(dir)).sort()).toEqual(['before-restore-20260607-080910.sqlite', 'manual-20260101-120000.sqlite']);
    expect(valueOf(join(backupsDir(dir), 'before-restore-20260607-080910.sqlite'))).toBe('in-wal');
    expect(existsSync(live + '-wal')).toBe(false);
    expect(valueOf(live)).toBe('backup');
  });

  it('still restores when the live database cannot be opened, keeping its main file', () => {
    const dir = setup();
    writeFileSync(join(dir, 'library.sqlite'), 'this is not a database'.repeat(100));
    mark(dir, { name: 'manual-20260101-120000.sqlite' });
    expect(applyPendingRestore(dir, new Date(2026, 5, 7, 8, 9, 10))).toBe('manual-20260101-120000.sqlite');
    expect(valueOf(join(dir, 'library.sqlite'))).toBe('backup');
    expect(readdirSync(backupsDir(dir)).sort()).toEqual(['before-restore-20260607-080910.sqlite', 'manual-20260101-120000.sqlite']);
    expect(readFileSync(join(backupsDir(dir), 'before-restore-20260607-080910.sqlite'), 'utf8')).toContain('this is not a database');
  });

  it('leaves the database alone and deletes the marker when the backup is missing', () => {
    const dir = setup();
    mark(dir, { name: 'manual-20260202-120000.sqlite' });
    expect(applyPendingRestore(dir)).toBeNull();
    expect(valueOf(join(dir, 'library.sqlite'))).toBe('live');
    expect(existsSync(join(dir, 'restore-pending.json'))).toBe(false);
    expect(readdirSync(backupsDir(dir))).toEqual(['manual-20260101-120000.sqlite']);
  });

  it('ignores names outside the backup pattern and unreadable markers', () => {
    const dir = setup();
    writeFileSync(join(dir, 'other.sqlite'), 'x');
    for (const content of [{ name: '../other.sqlite' }, '{not json', { name: 5 }]) {
      mark(dir, content);
      expect(applyPendingRestore(dir)).toBeNull();
      expect(existsSync(join(dir, 'restore-pending.json'))).toBe(false);
    }
    expect(valueOf(join(dir, 'library.sqlite'))).toBe('live');
  });
});
