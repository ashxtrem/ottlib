import { statfs } from 'node:fs/promises';
import type { HealthCheck } from '../HealthCheck.js';

export const DISK_WARN_BYTES = 1024 ** 3;
export const DISK_FAIL_BYTES = 256 * 1024 ** 2;

export type FreeBytes = (path: string) => Promise<number>;
const freeBytes: FreeBytes = async (path) => { const stats = await statfs(path); return stats.bavail * stats.bsize; };

const formatBytes = (bytes: number) => bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`;

/** Free space on the drive that holds the app data (database, posters, backups). */
export function diskSpaceCheck(appDataPath: string, free: FreeBytes = freeBytes): HealthCheck {
  return {
    id: 'disk-space',
    label: 'Disk space',
    async run() {
      const bytes = await free(appDataPath);
      const message = `${formatBytes(bytes)} free on the data drive.`;
      const fix = 'Free up space on the drive that holds OttLib’s data folder.';
      if (bytes < DISK_FAIL_BYTES) return { state: 'fail', message, fix };
      if (bytes < DISK_WARN_BYTES) return { state: 'warn', message, fix };
      return { state: 'ok', message };
    }
  };
}
