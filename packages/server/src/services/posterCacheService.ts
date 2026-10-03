import { access, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname, join } from 'node:path';
import { externalRequestTimeoutMs } from '../config/defaults.js';

export class PosterCacheService {
  public constructor(private readonly appDataPath: string) {}

  public async cache(url: string | null, kind: 'posters' | 'backdrops', key: string, refresh = false): Promise<string | null> {
    if (!url) return null;
    const extension = ['.jpg', '.jpeg', '.png', '.webp'].includes(extname(new URL(url).pathname).toLowerCase()) ? extname(new URL(url).pathname) : '.jpg';
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
    let filename = `${safeKey}${extension}`;
    const directory = join(this.appDataPath, kind);
    if (!refresh) {
      try { await access(join(directory, filename)); return filename; } catch { /* download below */ }
    }
    const response = await fetch(url, { signal: AbortSignal.timeout(externalRequestTimeoutMs) });
    if (!response.ok) {
      if (refresh) throw new Error(`Artwork refresh failed (${response.status})`);
      return null;
    }
    const contents = Buffer.from(await response.arrayBuffer());
    // A changed path also invalidates Android/web image caches when the provider keeps the same URL.
    if (refresh) filename = `${safeKey}-${createHash('sha256').update(contents).digest('hex').slice(0, 12)}${extension}`;
    await mkdir(directory, { recursive: true }); await writeFile(join(directory, filename), contents);
    return filename;
  }
}
