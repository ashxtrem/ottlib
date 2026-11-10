import Database from 'better-sqlite3';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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

  it('swaps in the chosen backup, keeps the old database as before-restore-* with its wal and shm, and deletes the marker', () => {
    const dir = setup();
    writeFileSync(join(dir, 'library.sqlite-wal'), 'wal'); writeFileSync(join(dir, 'library.sqlite-shm'), 'shm');
    mark(dir, { name: 'manual-20260101-120000.sqlite' });
    expect(applyPendingRestore(dir, new Date(2026, 5, 7, 8, 9, 10))).toBe('manual-20260101-120000.sqlite');
    expect(valueOf(join(dir, 'library.sqlite'))).toBe('backup');
    expect(existsSync(join(dir, 'restore-pending.json'))).toBe(false);
    expect(existsSync(join(dir, 'library.sqlite-wal'))).toBe(false);
    expect(existsSync(join(dir, 'library.sqlite-shm'))).toBe(false);
    expect(readdirSync(backupsDir(dir)).sort()).toEqual([
      'before-restore-20260607-080910.sqlite', 'before-restore-20260607-080910.sqlite-shm', 'before-restore-20260607-080910.sqlite-wal', 'manual-20260101-120000.sqlite'
    ]);
    expect(valueOf(join(backupsDir(dir), 'before-restore-20260607-080910.sqlite'))).toBe('live');
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
