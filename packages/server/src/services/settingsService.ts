import cron from 'node-cron';
import type { Settings, UpdateSettings } from '@ottlib/shared';
import { SettingRepository } from '../repositories/settingRepository.js';
import { SchedulerService } from './schedulerService.js';

const mask = (value: string) => value ? `••••${value.slice(-4)}` : '';
export class SettingsService {
  public constructor(private readonly settings: SettingRepository, private readonly scheduler: SchedulerService) {}
  public get(): Settings { const value = this.settings.get(); return { ...value, tmdbApiKey: mask(value.tmdbApiKey), omdbApiKey: mask(value.omdbApiKey) }; }
  public update(update: UpdateSettings): Settings {
    const safe = { ...update };
    if (safe.tmdbApiKey?.startsWith('••••')) delete safe.tmdbApiKey;
    if (safe.omdbApiKey?.startsWith('••••')) delete safe.omdbApiKey;
    if (safe.scheduleCron && !cron.validate(safe.scheduleCron)) throw new Error('Schedule must be a valid cron expression');
    const result = this.settings.update(safe); this.scheduler.refresh();
    return { ...result, tmdbApiKey: mask(result.tmdbApiKey), omdbApiKey: mask(result.omdbApiKey) };
  }
}
