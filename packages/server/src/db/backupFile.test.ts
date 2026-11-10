import Database from 'better-sqlite3';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BACKUP_NAME_PATTERN, SCHEMA_VERSION, backupFileName, backupStamp, backupsDir, pruneBackups, readSchemaVersion, vacuumInto, writeSchemaVersion } from './backupFile.js';
import { createDatabase } from './db.js';

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })));
const tempDir = () => { const directory = mkdtempSync(join(tmpdir(), 'ottlib-backup-')); directories.push(directory); return directory; };
const backupNames = (dir: string) => (existsSync(backupsDir(dir)) ? readdirSync(backupsDir(dir)).sort() : []);

/** A library from before the upgrade: tables exist, user_version is 0. */
function legacyLibrary(dir: string): void {
  const db = createDatabase(dir);
  db.prepare("INSERT INTO folders (path) VALUES ('E:/Movies')").run();
  db.prepare("INSERT INTO movies (folder_id, canonical_path, raw_filename, parsed_title, size, mtime_ms, last_seen_at) VALUES (1, 'E:/Movies/1.mkv', '1.mkv', 'Kept', 1, 1, 'x')").run();
  writeSchemaVersion(db, 0);
  db.close();
}

describe('backup file helpers', () => {
  it('stamps names that match the backup pattern and sort by time', () => {
    const early = backupFileName('daily', new Date(2026, 0, 2, 3, 4, 5));
    expect(early).toBe('daily-20260102-030405.sqlite');
    expect(BACKUP_NAME_PATTERN.test(early)).toBe(true);
    expect(backupStamp(new Date(2026, 11, 31, 23, 59, 59)) > backupStamp(new Date(2026, 0, 2))).toBe(true);
    expect(BACKUP_NAME_PATTERN.test('../library.sqlite')).toBe(false);
    expect(BACKUP_NAME_PATTERN.test('other-20260102-030405.sqlite')).toBe(false);
  });

  it('reads and writes user_version and vacuums a copy', () => {
    const dir = tempDir();
    const db = new Database(join(dir, 'a.sqlite'));
    db.exec('CREATE TABLE t (x INTEGER); INSERT INTO t VALUES (7)');
    expect(readSchemaVersion(db)).toBe(0);
    writeSchemaVersion(db, 5);
    expect(readSchemaVersion(db)).toBe(5);
    expect(() => writeSchemaVersion(db, -1)).toThrow();
    const copy = join(dir, 'copy.sqlite');
    vacuumInto(db, copy);
    vacuumInto(db, copy); // an existing file is replaced
    db.close();
    const restored = new Database(copy, { readonly: true });
    expect(restored.prepare('SELECT x FROM t').get()).toEqual({ x: 7 });
    expect(readSchemaVersion(restored)).toBe(5);
    restored.close();
  });

  it('prunes one kind to the newest N and leaves other files alone', () => {
    const dir = tempDir();
    for (const name of ['pre-update-20260101-000000', 'pre-update-20260102-000000', 'pre-update-20260103-000000', 'pre-update-20260104-000000', 'daily-20260101-000000']) writeFileSync(join(dir, `${name}.sqlite`), 'x');
    writeFileSync(join(dir, 'notes.txt'), 'x');
    expect(pruneBackups(dir, 'pre-update', 3)).toEqual(['pre-update-20260101-000000.sqlite']);
    expect(readdirSync(dir).sort()).toEqual(['daily-20260101-000000.sqlite', 'notes.txt', 'pre-update-20260102-000000.sqlite', 'pre-update-20260103-000000.sqlite', 'pre-update-20260104-000000.sqlite']);
    expect(pruneBackups(join(dir, 'missing'), 'pre-update', 3)).toEqual([]);
  });
});

describe('createDatabase backups', () => {
  it('writes a pre-update backup of an older library before migrating when asked', () => {
    const dir = tempDir();
    legacyLibrary(dir);
    const db = createDatabase(dir, { backupBeforeMigrate: true });
    expect(readSchemaVersion(db)).toBe(SCHEMA_VERSION);
    db.close();
    const names = backupNames(dir);
    expect(names).toHaveLength(1);
    expect(names[0]).toMatch(/^pre-update-\d{8}-\d{6}\.sqlite$/);
    const backup = new Database(join(backupsDir(dir), names[0]), { readonly: true });
    expect(backup.prepare('SELECT parsed_title FROM movies').all()).toEqual([{ parsed_title: 'Kept' }]); // the copy is the pre-migration state
    expect(readSchemaVersion(backup)).toBe(0); // taken before user_version was set
    backup.close();
  });

  it('takes no backup on a fresh install, and none once the schema is current', () => {
    const dir = tempDir();
    createDatabase(dir, { backupBeforeMigrate: true }).close();
    expect(backupNames(dir)).toEqual([]);
    createDatabase(dir, { backupBeforeMigrate: true }).close();
    expect(backupNames(dir)).toEqual([]);
  });

  it('writes no file without the option and still sets user_version', () => {
    const dir = tempDir();
    legacyLibrary(dir);
    const db = createDatabase(dir);
    expect(readSchemaVersion(db)).toBe(SCHEMA_VERSION);
    db.close();
    expect(existsSync(backupsDir(dir))).toBe(false);
  });

  it('keeps a newer schema version after a downgrade', () => {
    const dir = tempDir();
    const newer = createDatabase(dir);
    writeSchemaVersion(newer, SCHEMA_VERSION + 3);
    newer.close();
    const db = createDatabase(dir);
    expect(readSchemaVersion(db)).toBe(SCHEMA_VERSION + 3);
    db.close();
  });

  it('keeps only the newest three pre-update backups', () => {
    const dir = tempDir();
    mkdirSync(backupsDir(dir), { recursive: true });
    for (const day of ['01', '02', '03']) writeFileSync(join(backupsDir(dir), `pre-update-202601${day}-000000.sqlite`), 'x');
    legacyLibrary(dir);
    createDatabase(dir, { backupBeforeMigrate: true }).close();
    const names = backupNames(dir);
    expect(names).toHaveLength(3);
    expect(names).not.toContain('pre-update-20260101-000000.sqlite');
  });
});
