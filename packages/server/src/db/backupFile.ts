import type Database from 'better-sqlite3';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

/** The schema version the code expects; every migration added later bumps it. Stored as the database's `user_version`. */
export const SCHEMA_VERSION = 24;

export const BACKUP_KINDS = ['pre-update', 'daily', 'manual', 'before-restore'] as const;
export type BackupKind = (typeof BACKUP_KINDS)[number];

/** The only file names a backup may have; also the guard that keeps a restore request inside the backups folder. */
export const BACKUP_NAME_PATTERN = /^(pre-update|daily|manual|before-restore)-\d{8}-\d{6}\.sqlite$/;

/** Backups live in `backups/` beside library.sqlite. */
export const backupsDir = (dataDir: string): string => join(dataDir, 'backups');

/** `YYYYMMDD-HHmmss` in local time, so names sort oldest to newest. */
export function backupStamp(date: Date = new Date()): string {
  const two = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${two(date.getMonth() + 1)}${two(date.getDate())}-${two(date.getHours())}${two(date.getMinutes())}${two(date.getSeconds())}`;
}

export const backupFileName = (kind: BackupKind, date: Date = new Date()): string => `${kind}-${backupStamp(date)}.sqlite`;

/** Writes a consistent, compacted copy of the open database (WAL included) to `path`. An existing file there is replaced. */
export function vacuumInto(db: Database.Database, path: string): void {
  rmSync(path, { force: true });
  db.prepare('VACUUM INTO ?').run(path);
}

export function readSchemaVersion(db: Database.Database): number {
  return db.pragma('user_version', { simple: true }) as number;
}

export function writeSchemaVersion(db: Database.Database, version: number): void {
  if (!Number.isInteger(version) || version < 0) throw new Error(`Invalid schema version: ${version}`);
  db.pragma(`user_version = ${version}`);
}

/** Keeps the newest `keep` backups of one kind in `dir` and deletes the rest. Returns the deleted names. */
export function pruneBackups(dir: string, kind: BackupKind, keep: number): string[] {
  if (!existsSync(dir)) return [];
  const names = readdirSync(dir).filter((name) => BACKUP_NAME_PATTERN.test(name) && name.startsWith(`${kind}-`)).sort();
  const doomed = names.slice(0, Math.max(0, names.length - keep));
  for (const name of doomed) rmSync(join(dir, name), { force: true });
  return doomed;
}
