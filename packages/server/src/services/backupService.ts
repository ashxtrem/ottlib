import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Backup } from '@ottlib/shared';
import { BACKUP_NAME_PATTERN, backupFileName, backupsDir, pruneBackups, type BackupKind } from '../db/backupFile.js';
import { RESTORE_MARKER } from '../db/restorePending.js';
import { BackupRepository } from '../repositories/backupRepository.js';

/** How many backups of a kind are kept; `manual` and `before-restore` ones stay until the user deletes them. */
export const BACKUP_RETENTION: Partial<Record<BackupKind, number>> = { 'pre-update': 3, daily: 7 };

/** The `YYYYMMDD-HHmmss` part of a backup's name, newest sorts last. */
const stampOf = (backup: Backup): string => backup.name.slice(backup.kind.length + 1);

export interface DailyResult { ok: boolean; at: string; error?: string }

export class BackupService {
  private daily: DailyResult | null = null;
  private readonly dir: string;

  /** `dataDir` is the folder that holds library.sqlite; backups go in `backups/` beside it. */
  public constructor(private readonly records: BackupRepository, private readonly dataDir: string, private readonly now: () => Date = () => new Date()) {
    this.dir = backupsDir(dataDir);
  }

  public list(): Backup[] {
    if (!existsSync(this.dir)) return [];
    return readdirSync(this.dir)
      .filter((name) => BACKUP_NAME_PATTERN.test(name))
      .map((name): Backup => {
        const stats = statSync(join(this.dir, name));
        return { name, kind: name.slice(0, name.search(/-\d{8}-/)) as BackupKind, sizeBytes: stats.size, createdAt: stats.mtime.toISOString() };
      })
      .sort((a, b) => stampOf(b).localeCompare(stampOf(a)) || a.name.localeCompare(b.name));
  }

  public create(kind: BackupKind): Backup {
    try {
      mkdirSync(this.dir, { recursive: true });
      const name = backupFileName(kind, this.now());
      this.records.writeCopy(join(this.dir, name));
      this.prune();
      if (kind === 'daily') this.daily = { ok: true, at: this.now().toISOString() };
      const stats = statSync(join(this.dir, name));
      return { name, kind, sizeBytes: stats.size, createdAt: stats.mtime.toISOString() };
    } catch (error) {
      if (kind === 'daily') this.daily = { ok: false, at: this.now().toISOString(), error: error instanceof Error ? error.message : String(error) };
      throw error;
    }
  }

  public remove(name: string): void {
    const path = this.pathFor(name);
    if (!existsSync(path)) throw new Error('Backup not found');
    rmSync(path, { force: true });
  }

  /** Checks the backup and writes the restore marker; the database is swapped at the next server start. */
  public requestRestore(name: string): void {
    const path = this.pathFor(name);
    if (!existsSync(path)) throw new Error('Backup not found');
    const problem = this.records.problemWith(path);
    if (problem) throw new Error(problem);
    writeFileSync(join(this.dataDir, RESTORE_MARKER), JSON.stringify({ name }));
  }

  /** Applies the retention counts; returns the deleted names. */
  public prune(): string[] {
    return (Object.entries(BACKUP_RETENTION) as Array<[BackupKind, number]>).flatMap(([kind, keep]) => pruneBackups(this.dir, kind, keep));
  }

  /** The outcome of the latest daily run since the server started, or null when none has run yet. */
  public lastDailyResult(): DailyResult | null {
    return this.daily;
  }

  private pathFor(name: string): string {
    if (!BACKUP_NAME_PATTERN.test(name)) throw new Error('Invalid backup name');
    return join(this.dir, name);
  }
}
