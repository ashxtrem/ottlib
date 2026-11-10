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
  // Stage the copy first so a failed copy never leaves the live database moved away.
  const staged = `${live}.restoring`;
  const moved: string[] = [];
  try {
    copyFileSync(source, staged);
    for (const suffix of SIDE_FILES) {
      if (existsSync(live + suffix)) {
        renameSync(live + suffix, keptAs + suffix);
        moved.push(suffix);
      }
    }
    renameSync(staged, live);
  } catch (error) {
    for (const suffix of moved) {
      if (!existsSync(live + suffix)) renameSync(keptAs + suffix, live + suffix);
    }
    rmSync(staged, { force: true });
    console.error(`[restore] could not restore ${name}; the library database was left as it was`, error);
    return null;
  }
  return name;
}
