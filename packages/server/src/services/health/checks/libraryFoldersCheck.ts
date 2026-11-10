import { constants } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import type { HealthCheck } from '../HealthCheck.js';

/** True when the path is a folder this process can read. */
export async function folderReadable(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK);
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/** Every library folder must still exist and be readable; a missing one is named. */
export function libraryFoldersCheck(folders: () => string[], readable: (path: string) => Promise<boolean> = folderReadable): HealthCheck {
  return {
    id: 'library-folders',
    label: 'Library folders',
    async run() {
      const paths = folders();
      if (!paths.length) return { state: 'ok', message: 'No library folders yet.' };
      const results = await Promise.all(paths.map(async (path) => ({ path, ok: await readable(path) })));
      const broken = results.filter((result) => !result.ok).map((result) => result.path);
      if (!broken.length) return { state: 'ok', message: `${paths.length} folder${paths.length === 1 ? '' : 's'} readable.` };
      return {
        state: 'fail',
        message: `Cannot read ${broken.join(', ')}.`,
        fix: 'Reconnect the drive or share, check its permissions, or remove the folder under Settings → Folders.'
      };
    }
  };
}
