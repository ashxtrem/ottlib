import { access, mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { externalRequestTimeoutMs } from '../config/defaults.js';

export class PosterCacheService {
  public constructor(private readonly appDataPath: string) {}

  public async cache(url: string | null, kind: 'posters' | 'backdrops', key: string): Promise<string | null> {
    if (!url) return null;
    const extension = ['.jpg', '.jpeg', '.png', '.webp'].includes(extname(new URL(url).pathname).toLowerCase()) ? extname(new URL(url).pathname) : '.jpg';
    const filename = `${key.replace(/[^a-zA-Z0-9_-]/g, '_')}${extension}`;
    const directory = join(this.appDataPath, kind); const destination = join(directory, filename);
    try { await access(destination); return filename; } catch { /* download below */ }
    const response = await fetch(url, { signal: AbortSignal.timeout(externalRequestTimeoutMs) }); if (!response.ok) return null;
    await mkdir(directory, { recursive: true }); await writeFile(destination, Buffer.from(await response.arrayBuffer()));
    return filename;
  }
}
