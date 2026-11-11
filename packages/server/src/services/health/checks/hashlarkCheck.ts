import type { HealthCheck } from '../HealthCheck.js';

/** Find is set to Hashlark: the `hashlark://` link must be registered on the server PC, or Find has nothing to open. */
export function hashlarkCheck(available: () => boolean): HealthCheck {
  return {
    id: 'hashlark',
    label: 'Hashlark',
    async run() {
      if (available()) return { state: 'ok', message: 'Hashlark is installed on the server PC.' };
      return { state: 'warn', message: "Hashlark isn't installed on the server PC.", fix: 'Install Hashlark on the server PC and start it once so it registers its hashlark:// link, or switch Find back to qBittorrent under Settings.' };
    }
  };
}
