import cron, { type ScheduledTask } from 'node-cron';
import { SettingRepository } from '../repositories/settingRepository.js';
import { BackupService } from './backupService.js';

/** Every day at 04:00 server time. */
export const DAILY_BACKUP_CRON = '0 4 * * *';

export class BackupScheduler {
  private task: ScheduledTask | undefined;
  public constructor(private readonly settings: SettingRepository, private readonly backups: BackupService, private readonly log: (message: string) => void = () => undefined) {}

  public get active(): boolean { return this.task !== undefined; }

  public refresh(): void {
    this.stop();
    if (this.settings.get().backupEnabled) this.task = cron.schedule(DAILY_BACKUP_CRON, () => this.runDaily());
  }

  public stop(): void { this.task?.stop(); this.task = undefined; }

  private runDaily(): void {
    try { this.backups.create('daily'); } catch (error) { this.log(`Daily backup failed: ${error instanceof Error ? error.message : String(error)}`); }
  }
}
