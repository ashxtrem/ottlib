import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { BACKUP_NAME_PATTERN, backupFileName, backupsDir } from './backupFile.js';

export const RESTORE_MARKER = 'restore-pending.json';
const SIDE_FILES = ['', '-wal', '-shm'];

function pendingName(marker: string): string | null {
  try {
    const parsed = JSON.parse(readFileSync(marker, 'utf8')) as { name?: unknown };
    return typeof parsed.name === 'string' && BACKUP_NAME_PATTERN.test(parsed.name) ? parsed.name : null;
  } catch {
    return null;
  }
}

/**
 * Runs before the database opens. When `restore-pending.json` names a backup, the live database (with its -wal and -shm)
 * is kept as `backups/before-restore-<stamp>.sqlite` and the chosen backup is copied in its place. The marker is always
 * deleted; a missing or invalid backup leaves the database alone. Returns the restored backup's name, or null.
 */
export function applyPendingRestore(appDataPath: string, now: Date = new Date()): string | null {
  const marker = join(appDataPath, RESTORE_MARKER);
  if (!existsSync(marker)) return null;
  const name = pendingName(marker);
  const dir = backupsDir(appDataPath);
  const source = name ? join(dir, name) : null;
  rmSync(marker, { force: true });
  if (!name || !source || !existsSync(source)) return null;

  const live = join(appDataPath, 'library.sqlite');
  mkdirSync(dir, { recursive: true });
  const keptAs = join(dir, backupFileName('before-restore', now));
  for (const suffix of SIDE_FILES) {
    if (existsSync(live + suffix)) renameSync(live + suffix, keptAs + suffix);
  }
  copyFileSync(source, live);
  return name;
}
