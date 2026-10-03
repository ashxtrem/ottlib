import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PosterCacheService } from './posterCacheService.js';

const directories: string[] = [];
afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function subject() {
  const directory = await mkdtemp(join(tmpdir(), 'ottlib-artwork-')); directories.push(directory);
  await mkdir(join(directory, 'posters'));
  await writeFile(join(directory, 'posters', 'tmdb-42.jpg'), 'old poster');
  return { directory, cache: new PosterCacheService(directory) };
}

describe('PosterCacheService metadata refresh', () => {
  it('redownloads cached artwork and changes its path when contents change', async () => {
    const { directory, cache } = await subject();
    const fetch = vi.fn().mockResolvedValueOnce(new Response('new poster')).mockResolvedValueOnce(new Response('newer poster'));
    vi.stubGlobal('fetch', fetch);
    const first = await cache.cache('https://example.com/poster.jpg', 'posters', 'tmdb-42', true);
    const second = await cache.cache('https://example.com/poster.jpg', 'posters', 'tmdb-42', true);
    expect(first).not.toBe('tmdb-42.jpg');
    expect(second).not.toBe(first);
    expect(await readFile(join(directory, 'posters', first!), 'utf8')).toBe('new poster');
    expect(await readFile(join(directory, 'posters', 'tmdb-42.jpg'), 'utf8')).toBe('old poster');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('reuses the content path when refreshed artwork has not changed', async () => {
    const { cache } = await subject();
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response('same poster'))));
    expect(await cache.cache('https://example.com/a.jpg', 'posters', 'tmdb-42', true))
      .toBe(await cache.cache('https://example.com/a.jpg', 'posters', 'tmdb-42', true));
  });

  it('surfaces artwork download failure so refresh leaves saved metadata intact', async () => {
    const { directory, cache } = await subject();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
    await expect(cache.cache('https://example.com/a.jpg', 'posters', 'tmdb-42', true)).rejects.toThrow('Artwork refresh failed (503)');
    expect(await readFile(join(directory, 'posters', 'tmdb-42.jpg'), 'utf8')).toBe('old poster');
  });

  it('keeps ordinary metadata lookups using the existing disk cache', async () => {
    const { cache } = await subject();
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    expect(await cache.cache('https://example.com/a.jpg', 'posters', 'tmdb-42')).toBe('tmdb-42.jpg');
    expect(fetch).not.toHaveBeenCalled();
  });
});
