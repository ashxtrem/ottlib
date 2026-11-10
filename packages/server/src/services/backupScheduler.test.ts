import cron from 'node-cron';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SettingRepository } from '../repositories/settingRepository.js';
import { BackupScheduler, DAILY_BACKUP_CRON } from './backupScheduler.js';
import type { BackupService } from './backupService.js';

afterEach(() => vi.restoreAllMocks());

function fixture(backupEnabled: boolean) {
  const state = { backupEnabled };
  const create = vi.fn();
  const scheduler = new BackupScheduler({ get: () => state } as unknown as SettingRepository, { create } as unknown as BackupService, vi.fn());
  return { state, create, scheduler };
}

describe('BackupScheduler', () => {
  it('schedules 04:00 daily when backups are enabled', () => {
    const { scheduler } = fixture(true);
    const schedule = vi.spyOn(cron, 'schedule');
    scheduler.refresh();
    expect(schedule).toHaveBeenCalledWith(DAILY_BACKUP_CRON, expect.any(Function));
    expect(DAILY_BACKUP_CRON).toBe('0 4 * * *');
    expect(scheduler.active).toBe(true);
    scheduler.stop();
  });

  it('turning backupEnabled off stops the cron task', () => {
    const { state, scheduler } = fixture(true);
    const stop = vi.fn();
    vi.spyOn(cron, 'schedule').mockReturnValue({ stop } as unknown as ReturnType<typeof cron.schedule>);
    scheduler.refresh();
    expect(scheduler.active).toBe(true);
    state.backupEnabled = false;
    scheduler.refresh();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(scheduler.active).toBe(false);
  });

  it('does not schedule when disabled', () => {
    const { scheduler } = fixture(false);
    const schedule = vi.spyOn(cron, 'schedule');
    scheduler.refresh();
    expect(schedule).not.toHaveBeenCalled();
    expect(scheduler.active).toBe(false);
  });

  it('runs a daily backup on the tick and survives a failure', () => {
    const { create, scheduler } = fixture(true);
    let tick: (() => void) | undefined;
    vi.spyOn(cron, 'schedule').mockImplementation(((_expression: string, run: () => void) => { tick = run; return { stop: vi.fn() }; }) as unknown as typeof cron.schedule);
    scheduler.refresh();
    tick?.();
    expect(create).toHaveBeenCalledWith('daily');
    create.mockImplementation(() => { throw new Error('disk full'); });
    expect(() => tick?.()).not.toThrow();
  });
});
