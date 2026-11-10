import type { HealthCheck } from '../HealthCheck.js';

/** Matched titles that were never given their extras (cast photos, logo, trailer, collection) are still waiting for a metadata run. */
export function titleExtrasCheck(idsMissingExtras: () => number[]): HealthCheck {
  return {
    id: 'title-extras',
    label: 'Title extras',
    async run() {
      const pending = idsMissingExtras().length;
      if (pending === 0) return { state: 'ok', message: 'none pending' };
      return { state: 'warn', message: `${pending} matched titles have no extras yet`, fix: 'A metadata refresh fills them in and starts by itself when the server starts; restart the server, or run a metadata refresh, to start it now.' };
    }
  };
}
