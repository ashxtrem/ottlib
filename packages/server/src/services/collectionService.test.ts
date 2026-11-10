import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '../config/defaults.js';
import { createDatabase } from '../db/db.js';
import * as metadataProviders from '../providers/metadata/metadataProviders.js';
import type { MetadataProvider, TitleCollection } from '../providers/metadata/MetadataProvider.js';
import { CollectionRepository } from '../repositories/collectionRepository.js';
import { MovieExtrasRepository } from '../repositories/movieExtrasRepository.js';
import { MovieRepository } from '../repositories/movieRepository.js';
import { CollectionService } from './collectionService.js';
import type { PosterCacheService } from './posterCacheService.js';

const directories: string[] = [];
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })); });

const saga: TitleCollection = {
  id: 10, name: 'Saga Collection',
  parts: [
    { id: '102', title: 'Saga 2', year: 2004, posterUrl: 'https://image.tmdb.org/t/p/w500/two.jpg' },
    { id: '101', title: 'Saga 1', year: 2001, posterUrl: 'https://image.tmdb.org/t/p/w500/one.jpg' },
    { id: '103', title: 'Saga 3', year: 2007, posterUrl: null },
    { id: '100', title: 'Saga 0', year: null, posterUrl: null }
  ]
};

/** Titles 1 and 2 (Saga 1 and 3, added out of year order) are in collection 10; title 3 is in none. */
function library(): { movies: MovieRepository; collections: CollectionRepository; db: Database.Database } {
  const directory = mkdtempSync(join(tmpdir(), 'ottlib-collections-')); directories.push(directory);
  const db = createDatabase(directory); db.prepare('INSERT INTO folders (path) VALUES (?)').run('E:/Media');
  const movies = new MovieRepository(db); const extras = new MovieExtrasRepository(db);
  const seeds = [{ title: 'Saga 3', year: 2007, providerId: '103', collection: true }, { title: 'Saga 1', year: 2001, providerId: '101', collection: true }, { title: 'Standalone', year: 2010, providerId: '500', collection: false }];
  seeds.forEach((seed, index) => {
    movies.upsertScanned({ folderId: 1, path: `E:/Media/${index}.mkv`, filename: `${index}.mkv`, title: seed.title, year: seed.year, size: 1, mtimeMs: index + 1, seenAt: '2026-01-01T00:00:00.000Z' });
    movies.applyMetadata(index + 1, { source: 'tmdb', providerId: seed.providerId, mediaType: 'movie', title: seed.title, year: seed.year, overview: null, posterFile: null, backdropFile: null, genres: [], cast: [], rating: 7, runtime: 100, imdbId: `tt${seed.providerId}` });
    extras.applyExtras(index + 1, { castMembers: [], logoFile: null, collection: seed.collection ? { id: 10, name: 'Saga Collection' } : null, trailerKey: null });
  });
  return { movies, collections: new CollectionRepository(db), db };
}

function stubTmdb(getCollection: MetadataProvider['getCollection']): void {
  const provider: MetadataProvider = { name: 'tmdb', searchCandidates: async () => [], getDetails: async () => null, getCollection };
  vi.spyOn(metadataProviders, 'createMetadataProviders').mockReturnValue([provider]);
}
const posters = (cache = vi.fn(async (url: string | null, _kind: string, key: string) => (url ? `${key}.jpg` : null))) => ({ cache }) as unknown as PosterCacheService;
const settings = () => ({ ...defaultSettings, tmdbApiKey: 'key' });
const day = 24 * 60 * 60 * 1000;

describe('CollectionService', () => {
  it('lists the owned titles in year order and the parts the library lacks, with cached posters', async () => {
    stubTmdb(async () => saga);
    const { movies, collections, db } = library();
    try {
      const cache = vi.fn(async (url: string | null, _kind: string, key: string) => (url ? `${key}.jpg` : null));
      const result = await new CollectionService(movies, collections, posters(cache), settings).forMovie(1, undefined);
      expect(result).toMatchObject({ id: 10, name: 'Saga Collection' });
      expect(result?.owned.map((movie) => movie.title)).toEqual(['Saga 1', 'Saga 3']);
      expect(result?.missing).toEqual([
        { tmdbId: '102', title: 'Saga 2', year: 2004, posterUrl: '/media/posters/tmdb-part-102.jpg' },
        { tmdbId: '100', title: 'Saga 0', year: null, posterUrl: null }
      ]);
      expect(cache).toHaveBeenCalledWith('https://image.tmdb.org/t/p/w500/two.jpg', 'posters', 'tmdb-part-102');
    } finally { db.close(); }
  });

  it('answers null for a title without a collection and for an unknown title', async () => {
    stubTmdb(async () => saga);
    const { movies, collections, db } = library();
    try {
      const service = new CollectionService(movies, collections, posters(), settings);
      await expect(service.forMovie(3, undefined)).resolves.toBeNull();
      await expect(service.forMovie(99, undefined)).resolves.toBeNull();
    } finally { db.close(); }
  });

  it('leaves out an owned copy that is missing from disk, and so counts its part as missing', async () => {
    stubTmdb(async () => saga);
    const { movies, collections, db } = library();
    try {
      db.prepare('UPDATE movies SET missing = 1 WHERE id = 2').run();
      const result = await new CollectionService(movies, collections, posters(), settings).forMovie(1, undefined);
      expect(result?.owned.map((movie) => movie.title)).toEqual(['Saga 3']);
      expect(result?.missing.map((part) => part.tmdbId)).toEqual(['101', '102', '100']);
    } finally { db.close(); }
  });

  it('answers the owned titles with no missing parts when TMDb fails, has no key, or is slow', async () => {
    const { movies, collections, db } = library();
    try {
      stubTmdb(async () => { throw new Error('offline'); });
      expect((await new CollectionService(movies, collections, posters(), settings).forMovie(1, undefined))?.missing).toEqual([]);
      stubTmdb(async () => null);
      expect((await new CollectionService(movies, collections, posters(), settings).forMovie(1, undefined))?.missing).toEqual([]);
      vi.spyOn(metadataProviders, 'createMetadataProviders').mockReturnValue([]);
      const noKey = await new CollectionService(movies, collections, posters(), settings).forMovie(1, undefined);
      expect(noKey?.owned).toHaveLength(2); expect(noKey?.missing).toEqual([]);
      stubTmdb(() => new Promise(() => undefined));
      const slow = await new CollectionService(movies, collections, posters(), settings, undefined, 10).forMovie(1, undefined);
      expect(slow?.owned).toHaveLength(2); expect(slow?.missing).toEqual([]);
      expect(collections.get(10)).toBeUndefined();
    } finally { db.close(); }
  });

  it('caches the parts for 30 days, then fetches again', async () => {
    const getCollection = vi.fn(async () => saga);
    stubTmdb(getCollection);
    const { movies, collections, db } = library();
    try {
      let now = new Date('2026-01-01T00:00:00.000Z');
      const service = new CollectionService(movies, collections, posters(), settings, () => now);
      await service.forMovie(1, undefined);
      expect(collections.get(10)).toMatchObject({ name: 'Saga Collection', fetchedAt: '2026-01-01T00:00:00.000Z' });
      now = new Date(now.getTime() + 29 * day); await service.forMovie(1, undefined);
      expect(getCollection).toHaveBeenCalledTimes(1);
      now = new Date(now.getTime() + 2 * day); await service.forMovie(1, undefined);
      expect(getCollection).toHaveBeenCalledTimes(2);
    } finally { db.close(); }
  });

  it('caches posters for at most 20 missing parts', async () => {
    const parts = Array.from({ length: 25 }, (_, index) => ({ id: String(200 + index), title: `Part ${index}`, year: 2000 + index, posterUrl: `https://image.tmdb.org/t/p/w500/${index}.jpg` }));
    stubTmdb(async () => ({ id: 10, name: 'Saga Collection', parts }));
    const { movies, collections, db } = library();
    try {
      const cache = vi.fn(async (url: string | null, _kind: string, key: string) => (url ? `${key}.jpg` : null));
      const result = await new CollectionService(movies, collections, posters(cache), settings).forMovie(1, undefined);
      expect(result?.missing).toHaveLength(25);
      expect(cache).toHaveBeenCalledTimes(20);
      expect(result?.missing.filter((part) => part.posterUrl).length).toBe(20);
    } finally { db.close(); }
  });
});
