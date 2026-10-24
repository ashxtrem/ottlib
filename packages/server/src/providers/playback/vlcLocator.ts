import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { win32 } from 'node:path';
import { vlcExecutableName, vlcLookupCommand, vlcMacPath, vlcWindowsEnvRoots, vlcWindowsRelativePath } from '../../config/vlc.js';

/** Everything the locator asks of the machine, so tests can fake it. */
export interface VlcProbes {
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
  exists(path: string): boolean;
  /** First path the OS resolves `command` to (`where`/`which`), or null. */
  lookup(command: string): string | null;
}

export const systemVlcProbes: VlcProbes = {
  platform: process.platform,
  env: process.env,
  exists: (path) => existsSync(path),
  lookup(command) {
    try {
      const output = execFileSync(process.platform === 'win32' ? vlcLookupCommand.win32 : vlcLookupCommand.other, [command], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
      return output.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? null;
    } catch { return null; }
  }
};

/** Finds VLC once and remembers the answer (a path, or null when it is not installed). */
export class VlcLocator {
  private cached: string | null | undefined;
  public constructor(private readonly probes: VlcProbes = systemVlcProbes) {}

  public find(): string | null {
    if (this.cached === undefined) this.cached = this.search();
    return this.cached;
  }

  private search(): string | null {
    const { platform, env, exists, lookup } = this.probes;
    if (platform === 'darwin') return exists(vlcMacPath) ? vlcMacPath : null;
    if (platform === 'win32') {
      for (const name of vlcWindowsEnvRoots) {
        const root = env[name];
        if (!root) continue;
        const candidate = win32.join(root, vlcWindowsRelativePath);
        if (exists(candidate)) return candidate;
      }
    }
    return lookup(vlcExecutableName);
  }
}
