import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MetadataProvider } from '../providers/metadata/MetadataProvider.js';
import { createMetadataProviders } from '../providers/metadata/metadataProviders.js';
import type { MovieRepository } from '../repositories/movieRepository.js';
import type { SettingRepository } from '../repositories/settingRepository.js';
import { MetadataMatchService } from './metadataMatchService.js';
import type { PosterCacheService } from './posterCacheService.js';

vi.mock('../providers/metadata/metadataProviders.js', () => ({ createMetadataProviders: vi.fn() }));

function createSubject(score: number, mediaType: 'movie' | 'tv' = 'movie', rawFilename = 'Example.2024.mkv') {
  const provider: MetadataProvider = {
    name: 'tmdb',
    searchCandidates: vi.fn().mockResolvedValue([{ id: '42', title: 'Example', year: 2024, score, mediaType }]),
    getDetails: vi.fn().mockResolvedValue({ providerId: '42', title: 'Example', year: 2024, overview: 'Overview', posterUrl: null, backdropUrl: null, genres: [], cast: [], rating: null, runtime: null, imdbId: null })
  };
  const movies = {
    metadataTarget: vi.fn().mockReturnValue({ id: 1, title: 'Example', year: 2024, rawFilename }),
    saveCandidates: vi.fn(),
    getCandidates: vi.fn().mockReturnValue([{ id: 7, provider: 'tmdb', providerId: '42', title: 'Example', year: 2024, score, mediaType }]),
    getCandidate: vi.fn().mockReturnValue({ provider: 'tmdb', providerId: '42', mediaType }),
    applyMetadata: vi.fn()
  };
  const cache = { cache: vi.fn().mockResolvedValue(null) };
  vi.mocked(createMetadataProviders).mockReturnValue([provider]);
  const service = new MetadataMatchService(movies as unknown as MovieRepository, { get: vi.fn() } as unknown as SettingRepository, cache as unknown as PosterCacheService);
  return { service, movies, provider };
}

afterEach(() => vi.clearAllMocks());

describe('MetadataMatchService automatic scan acceptance', () => {
  it('accepts a top movie match strictly above 75% confidence', async () => {
    const { service, movies } = createSubject(0.76);
    await service.suggest(1, undefined, { autoAccept: true });
    expect(movies.saveCandidates).toHaveBeenCalledOnce();
    expect(movies.applyMetadata).toHaveBeenCalledWith(1, expect.objectContaining({ title: 'Example' }));
  });

  it('leaves a 75% match for review', async () => {
    const { service, movies, provider } = createSubject(0.75);
    await service.suggest(1, undefined, { autoAccept: true });
    expect(movies.saveCandidates).toHaveBeenCalledOnce();
    expect(provider.getDetails).not.toHaveBeenCalled();
    expect(movies.applyMetadata).not.toHaveBeenCalled();
  });

  it('leaves TV matches for review when the filename has no episode number', async () => {
    const { service, movies, provider } = createSubject(0.9, 'tv', 'Example.Show.mkv');
    await service.suggest(1, undefined, { autoAccept: true });
    expect(provider.getDetails).not.toHaveBeenCalled();
    expect(movies.applyMetadata).not.toHaveBeenCalled();
  });
});
