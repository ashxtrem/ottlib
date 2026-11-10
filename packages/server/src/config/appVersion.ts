import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The release version from the `VERSION` file the release bundle writes next to its launchers
 * (scripts/package-server.mjs). The launchers start the server in that folder, so it is read from the working directory.
 * Null when there is no such file (running from source).
 */
export function readAppVersion(directory = process.cwd()): string | null {
  try {
    const version = readFileSync(join(directory, 'VERSION'), 'utf8').trim();
    return version || null;
  } catch {
    return null;
  }
}
