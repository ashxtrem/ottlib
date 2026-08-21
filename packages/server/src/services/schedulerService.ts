import cron, { type ScheduledTask } from 'node-cron';
import { SettingRepository } from '../repositories/settingRepository.js';
import { ScanService } from './scanService.js';

export class SchedulerService {
  private task: ScheduledTask | undefined;
  public constructor(private readonly settings: SettingRepository, private readonly scanner: ScanService) {}
  public refresh(): void {
    this.task?.stop(); this.task = undefined;
    const settings = this.settings.get();
    if (settings.scheduleEnabled && cron.validate(settings.scheduleCron)) this.task = cron.schedule(settings.scheduleCron, () => { this.scanner.start(); });
  }
  public stop(): void { this.task?.stop(); this.task = undefined; }
}
