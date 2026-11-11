import { execFileSync, spawn as nodeSpawn } from 'node:child_process';
import { hashlarkCategory, hashlarkLauncher, hashlarkRegistryProbe, hashlarkScheme, hashlarkTitleMaxLength } from '../../config/hashlark.js';
import type { Spawner } from '../playback/localLaunch.js';
import type { FindHandoff, FindQuery } from './FindHandoff.js';

/** Runs a command and throws when it exits non-zero (like `execFileSync`). */
export type CommandProbe = (command: string, args: string[]) => void;

const defaultProbe: CommandProbe = (command, args) => { execFileSync(command, args, { stdio: 'ignore', windowsHide: true }); };

/** `hashlark://search?q=<title year>&cat=movies[&imdb=tt…]`; with no title just `hashlark://search`, which opens the app. */
export function hashlarkSearchUrl(query: FindQuery): string {
  const base = `${hashlarkScheme}://search`;
  const title = query.title?.trim().slice(0, hashlarkTitleMaxLength).trim();
  if (!title) return base;
  const text = query.year === undefined ? title : `${title} ${query.year}`;
  const parts = [`q=${encodeURIComponent(text)}`, `cat=${hashlarkCategory}`];
  if (query.imdbId) parts.push(`imdb=${encodeURIComponent(query.imdbId)}`);
  return `${base}?${parts.join('&')}`;
}

export class HashlarkLink implements FindHandoff {
  public readonly name = 'hashlark';
  public constructor(private readonly spawn: Spawner = nodeSpawn, private readonly probe: CommandProbe = defaultProbe, private readonly platform: string = process.platform) {}

  /** Windows only: the `hashlark` URL scheme is registered when its registry key exists. */
  public available(): boolean {
    if (this.platform !== 'win32') return false;
    try { this.probe(hashlarkRegistryProbe.command, [...hashlarkRegistryProbe.args]); return true; } catch { return false; }
  }

  public open(query: FindQuery): void {
    this.spawn(hashlarkLauncher.command, [...hashlarkLauncher.args, hashlarkSearchUrl(query)], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  }
}
