import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { movieCollectionSchema, movieFilterOptionsSchema, movieListPageSchema } from '@ottlib/shared';
import { buildApp } from '../app.js';
import { createDatabase } from '../db/db.js';
import * as metadataProviders from '../providers/metadata/metadataProviders.js';
import { MovieExtrasRepository } from '../repositories/movieExtrasRepository.js';
import { MovieRepository } from '../repositories/movieRepository.js';
import { PosterCacheService } from '../services/posterCacheService.js';

const directories: string[] = [];
afterEach(() => { vi.restoreAllMocks(); directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })); });

/** Titles 1 and 2 belong to collection 10, title 3 alone to collection 20, title 4 to none. */
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'ottlib-collection-routes-')); directories.push(directory);
  const db = createDatabase(join(directory, 'data')); db.prepare('INSERT INTO folders (path) VALUES (?)').run('E:/Media');
  const movies = new MovieRepository(db); const extras = new MovieExtrasRepository(db);
  const seeds: Array<{ title: string; year: number; collection: { id: number; name: string } | null }> = [
    { title: 'Saga 2', year: 2004, collection: { id: 10, name: 'Saga Collection' } }, { title: 'Saga 1', year: 2001, collection: { id: 10, name: 'Saga Collection' } },
    { title: 'Lonely', year: 2010, collection: { id: 20, name: 'Lonely Collection' } }, { title: 'Standalone', year: 2012, collection: null }
  ];
  seeds.forEach((seed, index) => {
    movies.upsertScanned({ folderId: 1, path: `E:/Media/${index}.mkv`, filename: `${index}.mkv`, title: seed.title, year: seed.year, size: 1, mtimeMs: index + 1, seenAt: '2026-01-01T00:00:00.000Z' });
    movies.applyMetadata(index + 1, { source: 'tmdb', providerId: String(100 + index), mediaType: 'movie', title: seed.title, year: seed.year, overview: null, posterFile: null, backdropFile: null, genres: [], cast: [], rating: 7, runtime: 100, imdbId: `tt${100 + index}` });
    extras.applyExtras(index + 1, { castMembers: [], logoFile: null, collection: seed.collection, trailerKey: null });
  });
  vi.spyOn(metadataProviders, 'createMetadataProviders').mockReturnValue([{
    name: 'tmdb', searchCandidates: async () => [], getDetails: async () => null,
    getCollection: async () => ({ id: 10, name: 'Saga Collection', parts: [{ id: '100', title: 'Saga 2', year: 2004, posterUrl: null }, { id: '101', title: 'Saga 1', year: 2001, posterUrl: null }, { id: '99', title: 'Saga 0', year: 1999, posterUrl: 'https://image.tmdb.org/t/p/w500/zero.jpg' }] })
  }]);
  vi.spyOn(PosterCacheService.prototype, 'cache').mockResolvedValue('tmdb-part-99.jpg');
  return { app: buildApp(db, join(directory, 'data'), 8081), db };
}

describe('collection routes', () => {
  it('returns the owned titles and the missing parts of a collection', async () => {
    const { app, db } = fixture();
    try {
      const response = await app.inject({ method: 'GET', url: '/api/movies/1/collection' });
      expect(response.statusCode).toBe(200);
      const collection = movieCollectionSchema.parse(response.json());
      expect(collection).toMatchObject({ id: 10, name: 'Saga Collection', missing: [{ tmdbId: '99', title: 'Saga 0', year: 1999, posterUrl: '/media/posters/tmdb-part-99.jpg' }] });
      expect(collection.owned.map((movie) => movie.title)).toEqual(['Saga 1', 'Saga 2']);
    } finally { await app.close(); db.close(); }
  });

  it('answers 404 for a title without a collection and for an unknown title', async () => {
    const { app, db } = fixture();
    try {
      expect((await app.inject({ method: 'GET', url: '/api/movies/4/collection' })).statusCode).toBe(404);
      expect((await app.inject({ method: 'GET', url: '/api/movies/999/collection' })).statusCode).toBe(404);
      expect((await app.inject({ method: 'GET', url: '/api/movies/abc/collection' })).statusCode).toBe(404);
    } finally { await app.close(); db.close(); }
  });

  it('filters the list with ?collection=', async () => {
    const { app, db } = fixture();
    try {
      const page = movieListPageSchema.parse((await app.inject({ method: 'GET', url: '/api/movies?collection=10' })).json());
      expect(page.items.map((movie) => movie.title)).toEqual(['Saga 1', 'Saga 2']);
      expect(page.total).toBe(2);
      expect(movieListPageSchema.parse((await app.inject({ method: 'GET', url: '/api/movies?collection=20' })).json()).items.map((movie) => movie.title)).toEqual(['Lonely']);
      expect(movieListPageSchema.parse((await app.inject({ method: 'GET', url: '/api/movies?collection=abc' })).json()).total).toBe(4);
    } finally { await app.close(); db.close(); }
  });

  it('lists only collections with two or more owned titles in the filter options', async () => {
    const { app, db } = fixture();
    try {
      const options = movieFilterOptionsSchema.parse((await app.inject({ method: 'GET', url: '/api/movies/filter-options' })).json());
      expect(options.collections).toEqual([{ id: 10, name: 'Saga Collection', count: 2 }]);
      db.prepare('UPDATE movies SET missing = 1 WHERE id = 1').run();
      expect(movieFilterOptionsSchema.parse((await app.inject({ method: 'GET', url: '/api/movies/filter-options' })).json()).collections).toEqual([]);
    } finally { await app.close(); db.close(); }
  });
});
