import cron from 'node-cron';
import type { ScheduleValidationResult, Settings, UpdateSettings } from '@ottlib/shared';
import { SettingRepository } from '../repositories/settingRepository.js';
import { SchedulerService } from './schedulerService.js';
import { TmdbProvider } from '../providers/metadata/tmdbProvider.js';

const mask = (value: string) => value ? `••••${value.slice(-4)}` : '';
export class SettingsService {
  public constructor(private readonly settings: SettingRepository, private readonly scheduler: SchedulerService) {}
  public get(): Settings { const value = this.settings.get(); return { ...value, tmdbApiKey: mask(value.tmdbApiKey), omdbApiKey: mask(value.omdbApiKey) }; }
  public update(update: UpdateSettings): Settings {
    const safe = { ...update };
    if (safe.tmdbApiKey?.startsWith('••••')) delete safe.tmdbApiKey;
    if (safe.omdbApiKey?.startsWith('••••')) delete safe.omdbApiKey;
    if (safe.scheduleCron !== undefined && !this.validateSchedule(safe.scheduleCron).valid) throw new Error('Schedule must be a valid cron expression');
    const result = this.settings.update(safe); this.scheduler.refresh();
    return { ...result, tmdbApiKey: mask(result.tmdbApiKey), omdbApiKey: mask(result.omdbApiKey) };
  }

  public validateSchedule(scheduleCron: string): ScheduleValidationResult {
    const expression = scheduleCron.trim();
    if (!expression || !cron.validate(expression)) return { valid: false, error: 'Enter a valid cron expression.' };
    let task: ReturnType<typeof cron.createTask> | undefined;
    try {
      task = cron.createTask(expression, () => undefined);
      const nextRun = task.getNextRuns(1)[0];
      return nextRun ? { valid: true, nextRun: nextRun.toISOString() } : { valid: false, error: 'Unable to determine the next scheduled scan.' };
    } catch {
      return { valid: false, error: 'Enter a valid cron expression.' };
    } finally {
      if (task) void task.destroy();
    }
  }

  public async testTmdbKey(input?: string): Promise<{ valid: true }> {
    const savedKey = this.settings.get().tmdbApiKey;
    const key = input?.startsWith('••••') || !input?.trim() ? savedKey : input.trim();
    if (!key) throw new Error('Enter a TMDb API key before testing it');
    try {
      await new TmdbProvider(key).searchCandidates('Inception', 2010, 1);
      return { valid: true };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Request failed';
      throw new Error(`TMDb key test failed: ${reason}`);
    }
  }
}
