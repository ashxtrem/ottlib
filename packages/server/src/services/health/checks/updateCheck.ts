import type { HealthCheck } from '../HealthCheck.js';
import { compareVersions } from '../latestRelease.js';

export const RELEASES_PAGE = 'https://github.com/ashxtrem/ottlib/releases/latest';

export interface UpdateCheckDeps {
  /** The bundle's `VERSION`, or null when running from source. */
  version: () => string | null;
  /** Setting `updateCheckEnabled`. */
  enabled: () => boolean;
  /** The newest release tag (`LatestRelease.tag`, cached for 24 h). */
  latestTag: () => Promise<string>;
}

/** Whether a newer release is out. Makes no request when running from source or with the setting off. */
export function updateCheck(deps: UpdateCheckDeps): HealthCheck {
  return {
    id: 'update',
    label: 'Updates',
    async run() {
      const version = deps.version();
      if (!version) return { state: 'ok', message: 'Running from source.' };
      if (!deps.enabled()) return { state: 'ok', message: `Version ${version}; the update check is off.` };
      let tag: string;
      try {
        tag = await deps.latestTag();
      } catch (error) {
        return { state: 'warn', message: `Could not check for updates: ${error instanceof Error ? error.message : String(error)}.`, fix: 'Check the server’s internet connection.' };
      }
      const latest = tag.replace(/^v/i, '');
      if (compareVersions(version, latest) < 0) return { state: 'warn', message: `OttLib ${latest} is out (this is ${version}).`, fix: `Download it from ${RELEASES_PAGE}.` };
      return { state: 'ok', message: `Version ${version} is the newest.` };
    }
  };
}
