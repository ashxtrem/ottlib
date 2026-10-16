import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '../../config/defaults.js';
import { createDatabase } from '../../db/db.js';
import * as metadataProviders from '../../providers/metadata/metadataProviders.js';
import type { MetadataProvider } from '../../providers/metadata/MetadataProvider.js';
import { MovieRepository } from '../../repositories/movieRepository.js';
import { RecommendationSignalRepository } from '../../repositories/recommendationSignalRepository.js';
import { RecommendationService } from './recommendationService.js';

const directories: string[] = [];
afterEach(() => { vi.restoreAllMocks(); directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })); });

interface Seed { title: string; year: number; genres: string[]; cast?: string[]; providerId: string; mediaType?: 'movie' | 'tv'; season?: number; episode?: number; imdbId?: string }

function library(seeds: Seed[]): { movies: MovieRepository; signals: RecommendationSignalRepository; db: Database.Database } {
  const directory = mkdtempSync(join(tmpdir(), 'ottlib-recs-')); directories.push(directory);
  const db = createDatabase(directory); db.prepare('INSERT INTO folders (path) VALUES (?)').run('E:/Media');
  const movies = new MovieRepository(db);
  seeds.forEach((seed, index) => {
    movies.upsertScanned({ folderId: 1, path: `E:/Media/${index}.mkv`, filename: `${index}.mkv`, title: seed.title, year: seed.year, size: 1, mtimeMs: index + 1, seenAt: '2026-01-01T00:00:00.000Z' });
    movies.applyMetadata(index + 1, { source: 'tmdb', providerId: seed.providerId, mediaType: seed.mediaType ?? 'movie', season: seed.season ?? null, episode: seed.episode ?? null, title: seed.title, year: seed.year, overview: null, posterFile: null, backdropFile: null, genres: seed.genres, cast: seed.cast ?? [], rating: 7, runtime: 100, imdbId: seed.imdbId ?? `tt${seed.providerId}` });
  });
  return { movies, signals: new RecommendationSignalRepository(db), db };
}

const settings = () => ({ ...defaultSettings, tmdbApiKey: 'key' });
function stubTmdb(getRecommendations: MetadataProvider['getRecommendations']): void {
  const provider: MetadataProvider = { name: 'tmdb', searchCandidates: async () => [], getDetails: async () => null, getRecommendations };
  vi.spyOn(metadataProviders, 'createMetadataProviders').mockReturnValue([provider]);
}

describe('RecommendationService', () => {
  const seeds: Seed[] = [
    { title: 'Blade Runner', year: 1982, genres: ['Sci-Fi', 'Thriller'], providerId: '78' },
    { title: 'Ex Machina', year: 2014, genres: ['Sci-Fi', 'Thriller'], providerId: '264660' },
    { title: 'Paddington', year: 2014, genres: ['Family', 'Comedy'], providerId: '116149' },
    { title: 'Severance', year: 2022, genres: ['Sci-Fi', 'Thriller'], providerId: '95396', mediaType: 'tv', season: 1, episode: 1, imdbId: 'tt11280740' },
    { title: 'Severance', year: 2022, genres: ['Sci-Fi', 'Thriller'], providerId: '95396', mediaType: 'tv', season: 1, episode: 2, imdbId: 'tt11280740' }
  ];

  it('recommends similar titles, lists a show once, and leaves out the title itself and unrelated ones', async () => {
    vi.spyOn(metadataProviders, 'createMetadataProviders').mockReturnValue([]);
    const { movies, signals, db } = library(seeds);
    try {
      const result = await new RecommendationService(movies, signals, settings).forMovie(1, undefined, 10);
      expect(result.map((item) => item.movie.title)).toEqual(expect.arrayContaining(['Ex Machina', 'Severance']));
      expect(result.map((item) => item.movie.title)).not.toContain('Paddington');
      expect(result.map((item) => item.movie.title)).not.toContain('Blade Runner');
      expect(result.filter((item) => item.movie.title === 'Severance')).toHaveLength(1);
    } finally { db.close(); }
  });

  it('never recommends another episode of the show being viewed', async () => {
    vi.spyOn(metadataProviders, 'createMetadataProviders').mockReturnValue([]);
    const { movies, signals, db } = library(seeds);
    try {
      const result = await new RecommendationService(movies, signals, settings).forMovie(5, undefined, 10);
      expect(result.map((item) => item.movie.title)).not.toContain('Severance');
      expect(result.map((item) => item.movie.title)).toContain('Blade Runner');
    } finally { db.close(); }
  });

  it('lets the provider signal bring in a title the library alone would not, and caches it', async () => {
    const fetch = vi.fn(async () => ['116149']);
    stubTmdb(fetch);
    const { movies, signals, db } = library(seeds);
    try {
      const service = new RecommendationService(movies, signals, settings);
      const first = await service.forMovie(1, undefined, 10);
      expect(first.find((item) => item.movie.title === 'Paddington')?.reason).toBe('Viewers of this title also liked it');
      await service.forMovie(1, undefined, 10);
      expect(fetch).toHaveBeenCalledTimes(1);
    } finally { db.close(); }
  });

  it('falls back to the library alone when the provider fails', async () => {
    stubTmdb(async () => { throw new Error('TMDb is down'); });
    const { movies, signals, db } = library(seeds);
    try {
      const result = await new RecommendationService(movies, signals, settings).forMovie(1, undefined, 10);
      expect(result.map((item) => item.movie.title)).toContain('Ex Machina');
      expect(result.map((item) => item.movie.title)).not.toContain('Paddington');
    } finally { db.close(); }
  });

  it('returns nothing for an unmatched title', async () => {
    vi.spyOn(metadataProviders, 'createMetadataProviders').mockReturnValue([]);
    const { movies, signals, db } = library(seeds);
    try {
      movies.markUnmatched(1);
      expect(await new RecommendationService(movies, signals, settings).forMovie(1, undefined, 10)).toEqual([]);
    } finally { db.close(); }
  });
});
