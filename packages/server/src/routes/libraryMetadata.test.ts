import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { movieSchema, scanRunSchema } from '@ottlib/shared';
import { buildApp } from '../app.js';
import { createDatabase } from '../db/db.js';
import { createMetadataProviders } from '../providers/metadata/metadataProviders.js';
import { MovieRepository } from '../repositories/movieRepository.js';

vi.mock('../providers/metadata/metadataProviders.js', () => ({ createMetadataProviders: vi.fn() }));

const cleanups: Array<() => Promise<void>> = [];
const original = { folderId: 1, path: 'E:/Movies/example.mkv', filename: 'Example.2024.mkv', title: 'Example', year: 2024, size: 100, mtimeMs: 1, seenAt: '2026-01-01T00:00:00.000Z' };
const newCandidate = { id: '1325734', title: 'The Drama', year: 2026, score: 1, mediaType: 'movie' as const };

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'ottlib-library-metadata-'));
  const db = createDatabase(directory);
  db.prepare('INSERT INTO folders (path) VALUES (?)').run('E:/Movies');
  const movies = new MovieRepository(db);
  movies.upsertScanned(original);
  movies.applyMetadata(1, { source: 'tmdb', providerId: '1368337', mediaType: 'movie', imdbId: 'tt33764258', title: 'The Odyssey', year: 2026, overview: 'Odysseus journeys home.', posterFile: 'odyssey.jpg', backdropFile: 'odyssey-backdrop.jpg', genres: ['Adventure'], cast: ['Matt Damon'], rating: 8, runtime: 173 });
  const provider = {
    name: 'tmdb',
    searchCandidates: vi.fn().mockResolvedValue([{ ...newCandidate, score: 0.6 }]),
    getByImdbId: vi.fn().mockResolvedValue(newCandidate),
    getDetails: vi.fn().mockResolvedValue({ providerId: newCandidate.id, title: newCandidate.title, year: newCandidate.year, overview: 'A wedding week goes off the rails.', posterUrl: null, backdropUrl: null, genres: ['Drama'], cast: ['Zendaya'], rating: 7, runtime: 105, imdbId: 'tt33071426' })
  };
  vi.mocked(createMetadataProviders).mockReturnValue([provider]);
  const app = buildApp(db, directory, 8081);
  cleanups.push(async () => { await app.close(); db.close(); rmSync(directory, { recursive: true, force: true }); });
  const detail = async () => movieSchema.parse((await app.inject({ method: 'GET', url: '/api/movies/1' })).json());
  return { app, movies, provider, detail };
}

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  vi.clearAllMocks();
});

describe('library metadata lifecycle', () => {
  it('keeps saved details coherent through IMDb lookup, dismissal and replacement acceptance', async () => {
    const { app, provider, detail } = fixture();
    const accepted = await detail();
    const lookup = () => app.inject({ method: 'POST', url: '/api/movies/1/candidates/from-imdb', payload: { imdbId: 'https://www.imdb.com/title/tt33071426/' } });

    const suggested = await lookup();
    expect(suggested.statusCode).toBe(200);
    expect(movieSchema.parse(suggested.json())).toEqual({ ...accepted, metadataStatus: 'suggested' });
    expect(provider.getByImdbId).toHaveBeenCalledWith('tt33071426');
    expect(provider.getDetails).not.toHaveBeenCalled();
    const candidates = (await app.inject({ method: 'GET', url: '/api/movies/1/candidates' })).json();
    expect(candidates).toMatchObject([{ title: 'The Drama', providerId: '1325734' }]);

    const dismissed = await app.inject({ method: 'POST', url: '/api/movies/1/candidates/reject' });
    expect(dismissed.statusCode).toBe(200);
    expect(movieSchema.parse(dismissed.json())).toEqual(accepted);

    await lookup();
    const replacement = (await app.inject({ method: 'GET', url: '/api/movies/1/candidates' })).json()[0];
    const saved = await app.inject({ method: 'POST', url: `/api/movies/1/candidates/${replacement.id}/accept`, payload: {} });
    expect(saved.statusCode).toBe(200);
    expect(movieSchema.parse(saved.json())).toMatchObject({ title: 'The Drama', year: 2026, metadataStatus: 'matched', imdbId: 'tt33071426', overview: 'A wedding week goes off the rails.', cast: ['Zendaya'], posterUrl: null, backdropUrl: null, runtime: 105 });
    expect((await app.inject({ method: 'GET', url: '/api/movies/1/candidates' })).json()).toEqual([]);
  });

  it.each(['suggestion', 'no-match', 'provider-error'] as const)('searches a changed file by parsed title without stale provider details (%s)', async (outcome) => {
    const { app, movies, provider, detail } = fixture();
    movies.upsertScanned({ ...original, title: 'Replacement', year: 2025, size: 101 });
    if (outcome === 'no-match') provider.searchCandidates.mockResolvedValue([]);
    if (outcome === 'provider-error') provider.searchCandidates.mockRejectedValue(new Error('Provider unavailable'));

    const started = await app.inject({ method: 'POST', url: '/api/movies/metadata-refresh', payload: { movieIds: [1] } });
    expect(started.statusCode).toBe(200);
    await vi.waitFor(async () => {
      const status = await app.inject({ method: 'GET', url: '/api/movies/metadata-refresh/status' });
      expect(scanRunSchema.parse(status.json()).status).toBe('completed');
    });

    expect(provider.searchCandidates).toHaveBeenCalledWith('Replacement', 2025);
    expect(provider.getDetails).not.toHaveBeenCalled();
    expect(provider.getByImdbId).not.toHaveBeenCalled();
    const movie = await detail();
    expect(movie).toMatchObject({ title: outcome === 'suggestion' ? 'The Drama' : 'Replacement', metadataStatus: outcome === 'suggestion' ? 'suggested' : outcome === 'no-match' ? 'unmatched' : 'error', metadataSource: null, imdbId: null, mediaType: null, season: null, episode: null, overview: null, posterUrl: null, backdropUrl: null, genres: [], cast: [], rating: null, runtime: null });
    const page = (await app.inject({ method: 'GET', url: '/api/movies' })).json();
    expect(page.items[0]).toMatchObject({ title: movie.title, posterUrl: null });
  });

  it('keeps accepted metadata intact when refreshing its provider fails', async () => {
    const { app, provider, detail } = fixture();
    const accepted = await detail();
    provider.getDetails.mockRejectedValue(new Error('Provider unavailable'));

    expect((await app.inject({ method: 'POST', url: '/api/movies/metadata-refresh', payload: { movieIds: [1] } })).statusCode).toBe(200);
    await vi.waitFor(async () => {
      const status = scanRunSchema.parse((await app.inject({ method: 'GET', url: '/api/movies/metadata-refresh/status' })).json());
      expect(status).toMatchObject({ status: 'completed', titlesAdded: 0, errorSummary: expect.stringContaining('Provider unavailable') });
    });

    expect(await detail()).toEqual(accepted);
    expect(provider.getDetails).toHaveBeenCalledWith('1368337', 'movie');
    expect(provider.searchCandidates).not.toHaveBeenCalled();
  });
});
