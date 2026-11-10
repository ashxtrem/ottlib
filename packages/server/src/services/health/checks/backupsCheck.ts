import type { Backup } from '@ottlib/shared';
import type { DailyResult } from '../../backupService.js';
import type { HealthCheck } from '../HealthCheck.js';

export const BACKUP_MAX_AGE_MS = 8 * 24 * 60 * 60 * 1000;

export interface BackupSource { list(): Backup[]; lastDailyResult(): DailyResult | null }

/** A recent database backup exists, and the last daily run (since the server started) did not fail. */
export function backupsCheck(backups: BackupSource, now: () => Date = () => new Date()): HealthCheck {
  return {
    id: 'backups',
    label: 'Backups',
    async run() {
      const daily = backups.lastDailyResult();
      if (daily && !daily.ok) return { state: 'fail', message: `The daily backup at ${daily.at} failed: ${daily.error ?? 'unknown error'}.`, fix: 'Check free space and permissions on the data folder, then make a backup under Settings → Backups.' };
      const newest = backups.list().map((backup) => Date.parse(backup.createdAt)).filter(Number.isFinite).sort((a, b) => b - a)[0];
      const fix = 'Make a backup under Settings → Backups, and keep daily backups on.';
      if (newest === undefined) return { state: 'warn', message: 'No backup yet.', fix };
      if (now().getTime() - newest > BACKUP_MAX_AGE_MS) return { state: 'warn', message: `The newest backup is from ${new Date(newest).toISOString().slice(0, 10)}.`, fix };
      return { state: 'ok', message: `Newest backup: ${new Date(newest).toISOString()}.` };
    }
  };
}
