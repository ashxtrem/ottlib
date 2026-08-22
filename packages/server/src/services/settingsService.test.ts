import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SettingRepository } from '../repositories/settingRepository.js';
import type { SchedulerService } from './schedulerService.js';
import { SettingsService } from './settingsService.js';

const mocks = vi.hoisted(() => ({ searchCandidates: vi.fn(), TmdbProvider: vi.fn() }));
vi.mock('../providers/metadata/tmdbProvider.js', () => ({ TmdbProvider: mocks.TmdbProvider }));

function createService(savedKey = 'saved-key') {
  mocks.TmdbProvider.mockImplementation(() => ({ searchCandidates: mocks.searchCandidates }));
  return new SettingsService({ get: vi.fn().mockReturnValue({ tmdbApiKey: savedKey }) } as unknown as SettingRepository, {} as SchedulerService);
}

afterEach(() => vi.clearAllMocks());

describe('SettingsService TMDb key test', () => {
  it('tests a newly entered key before it is saved', async () => {
    mocks.searchCandidates.mockResolvedValue([]);
    await expect(createService().testTmdbKey('new-key')).resolves.toEqual({ valid: true });
    expect(mocks.TmdbProvider).toHaveBeenCalledWith('new-key');
    expect(mocks.searchCandidates).toHaveBeenCalledWith('Inception', 2010, 1);
  });

  it('tests the saved key when the field contains its mask', async () => {
    mocks.searchCandidates.mockResolvedValue([]);
    await createService().testTmdbKey('••••-key');
    expect(mocks.TmdbProvider).toHaveBeenCalledWith('saved-key');
  });

  it('reports a failed provider request clearly', async () => {
    mocks.searchCandidates.mockRejectedValue(new Error('TMDb search failed (401)'));
    await expect(createService().testTmdbKey('invalid-key')).rejects.toThrow('TMDb key test failed: TMDb search failed (401)');
  });
});

describe('SettingsService schedule validation', () => {
  it('returns the next run for a valid cron expression', () => {
    const result = createService().validateSchedule('0 3 * * *');
    expect(result.valid).toBe(true);
    expect(result.nextRun).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('rejects an invalid cron expression without saving settings', () => {
    expect(createService().validateSchedule('not a schedule')).toEqual({ valid: false, error: 'Enter a valid cron expression.' });
  });
});
