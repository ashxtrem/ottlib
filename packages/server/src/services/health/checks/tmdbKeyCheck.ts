import type { HealthCheck } from '../HealthCheck.js';

/** The saved TMDb key, tried with the same search as Settings → Test (`checkTmdbKey` in settingsService.ts). */
export function tmdbKeyCheck(key: () => string, test: (key: string) => Promise<unknown>): HealthCheck {
  return {
    id: 'tmdb-key',
    label: 'TMDb key',
    async run() {
      const value = key().trim();
      if (!value) return { state: 'warn', message: 'No TMDb key is set, so titles get no posters or details.', fix: 'Add a TMDb API key under Settings → Metadata.' };
      try {
        await test(value);
        return { state: 'ok', message: 'TMDb accepted the key.' };
      } catch (error) {
        return { state: 'fail', message: error instanceof Error ? error.message : 'TMDb rejected the key.', fix: 'Check the TMDb API key under Settings → Metadata.' };
      }
    }
  };
}
