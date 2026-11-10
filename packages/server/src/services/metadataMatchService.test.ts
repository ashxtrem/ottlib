import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MetadataProvider } from '../providers/metadata/MetadataProvider.js';
import { createMetadataProviders } from '../providers/metadata/metadataProviders.js';
import type { MovieRepository } from '../repositories/movieRepository.js';
import type { SettingRepository } from '../repositories/settingRepository.js';
import { MetadataMatchService } from './metadataMatchService.js';
import type { PosterCacheService } from './posterCacheService.js';
import type { ScanRunRepository } from '../repositories/scanRunRepository.js';
import type { MovieExtrasRepository } from '../repositories/movieExtrasRepository.js';
import { createRatingsProviders } from '../providers/metadata/ratingsProviders.js';
import { RatingsLimitReachedError, type RatingsProvider } from '../providers/metadata/RatingsProvider.js';

vi.mock('../providers/metadata/metadataProviders.js', () => ({ createMetadataProviders: vi.fn() }));

vi.mock('../providers/metadata/ratingsProviders.js', () => ({ createRatingsProviders: vi.fn().mockReturnValue([]) }));

function extrasRepo(ratingsDue = true) {
  return { applyExtras: vi.fn(), applyRatings: vi.fn(), deferRatings: vi.fn(), extrasFor: vi.fn(), ratingsDue: vi.fn().mockReturnValue(ratingsDue) };
}

function createSubject(score: number, mediaType: 'movie' | 'tv' = 'movie', rawFilename = 'Example.2024.mkv', runs?: ScanRunRepository, extras?: ReturnType<typeof extrasRepo>) {
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
    applyMetadata: vi.fn(),
    get: vi.fn().mockReturnValue({ metadataStatus: 'matched', season: null as number | null, episode: null as number | null }),
    resetForRematch: vi.fn(),
    listMetadataRefreshTargets: vi.fn(),
    listMatchedWithoutMediaType: vi.fn(),
    setMetadataMediaType: vi.fn(),
    listSuggestedMetadataTargets: vi.fn(),
    countSuggestedMetadataTargets: vi.fn()
  };
  const cache = { cache: vi.fn().mockResolvedValue(null) };
  vi.mocked(createMetadataProviders).mockReturnValue([provider]);
  vi.mocked(createRatingsProviders).mockReturnValue([]);
  const service = new MetadataMatchService(movies as unknown as MovieRepository, { get: vi.fn().mockReturnValue({}) } as unknown as SettingRepository, cache as unknown as PosterCacheService, runs, extras as unknown as MovieExtrasRepository);
  return { service, movies, provider, cache };
}

afterEach(() => vi.clearAllMocks());

describe('MetadataMatchService automatic scan acceptance', () => {
  it('keeps manual match results out of the persisted review queue', async () => {
    const { service, movies } = createSubject(0.6);

    await expect(service.findManualCandidates(1, 'Example')).resolves.toEqual([
      expect.objectContaining({ provider: 'tmdb', providerId: '42', title: 'Example' })
    ]);

    expect(movies.saveCandidates).not.toHaveBeenCalled();
  });

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

  it('accepts a TV show match when the provider cannot map the filename season to an episode', async () => {
    const { service, movies, provider } = createSubject(0.9, 'tv', 'Example - S02 E01.mkv');
    provider.getEpisodeDetails = vi.fn().mockResolvedValue(null);

    await service.suggest(1, undefined, { autoAccept: true });

    expect(movies.applyMetadata).toHaveBeenCalledWith(1, expect.objectContaining({ title: 'Example · S2E1' }));
  });

  it('uses the episode carried by an IMDb match when accepting it', async () => {
    const { service, movies, provider } = createSubject(0.9, 'tv', 'Show.without.episode.number.mkv');
    movies.getCandidate.mockReturnValue({ provider: 'tmdb', providerId: '42', mediaType: 'tv', season: 3, episode: 7 });
    provider.getEpisodeDetails = vi.fn().mockResolvedValue({ title: 'The correct episode', overview: null, stillUrl: null, rating: null });

    await expect(service.accept(1, 7)).resolves.toBe('ok');

    expect(provider.getEpisodeDetails).toHaveBeenCalledWith('42', 3, 7);
    expect(movies.applyMetadata).toHaveBeenCalledWith(1, expect.objectContaining({ title: 'Example · S3E7 · The correct episode', season: 3, episode: 7 }));
  });

  it('saves the season and episode returned from an IMDb lookup', async () => {
    const { service, movies, provider } = createSubject(0.9);
    provider.getByImdbId = vi.fn().mockResolvedValue({ id: '42', title: 'Example', year: 2024, score: 1, mediaType: 'tv', season: 3, episode: 7 });

    await expect(service.suggestFromImdb(1, 'https://www.imdb.com/title/tt1746926/')).resolves.toBe('ok');

    expect(movies.saveCandidates).toHaveBeenCalledWith(1, [expect.objectContaining({ mediaType: 'tv', season: 3, episode: 7 })]);
  });

  it('backfills only confident saved suggestions and reports the remaining review count', async () => {
    const { service, movies } = createSubject(0.9);
    movies.listSuggestedMetadataTargets = vi.fn().mockReturnValue([{ id: 1, title: 'Example', year: 2024, rawFilename: 'Example.2024.mkv' }, { id: 2, title: 'Needs review', year: 2024, rawFilename: 'Needs.review.mkv' }]);
    movies.getCandidates = vi.fn().mockImplementation((id: number) => id === 1 ? [{ id: 7, provider: 'tmdb', providerId: '42', title: 'Example', year: 2024, score: 0.9, mediaType: 'movie' }] : [{ id: 8, provider: 'tmdb', providerId: '43', title: 'Needs review', year: 2024, score: 0.75, mediaType: 'movie' }]);
    movies.countSuggestedMetadataTargets = vi.fn().mockReturnValue(1);

    await expect(service.backfillAutoAccept()).resolves.toEqual({ accepted: 1, stillNeedsReview: 1 });
    expect(movies.applyMetadata).toHaveBeenCalledOnce();
    expect(service.countAutoAcceptableSuggestions()).toBe(1);
  });

  it('continues the backfill when one candidate cannot be accepted', async () => {
    const { service, movies, provider } = createSubject(0.9);
    movies.listSuggestedMetadataTargets.mockReturnValue([{ id: 1, title: 'First', year: 2024, rawFilename: 'First.mkv' }, { id: 2, title: 'Second', year: 2024, rawFilename: 'Second.mkv' }]);
    movies.getCandidates.mockReturnValue([{ id: 7, provider: 'tmdb', providerId: '42', title: 'Example', year: 2024, score: 0.9, mediaType: 'movie' }]);
    movies.countSuggestedMetadataTargets.mockReturnValue(1);
    provider.getDetails = vi.fn().mockRejectedValueOnce(new Error('Temporary provider failure')).mockResolvedValue({ providerId: '42', title: 'Example', year: 2024, overview: 'Overview', posterUrl: null, backdropUrl: null, genres: [], cast: [], rating: null, runtime: null, imdbId: null });

    await expect(service.backfillAutoAccept()).resolves.toEqual({ accepted: 1, stillNeedsReview: 1 });
    expect(movies.applyMetadata).toHaveBeenCalledOnce();
  });

  it('runs the backfill in the background and records individual failures', async () => {
    const run = { id: 17, kind: 'auto-accept' as const, status: 'running' as const, startedAt: '2026-01-01T00:00:00.000Z', finishedAt: null, filesFound: 0, filesProcessed: 0, titlesAdded: 0, errorSummary: null };
    const runs = { active: vi.fn(), create: vi.fn().mockReturnValue(run), progress: vi.fn(), finish: vi.fn(), latest: vi.fn() } as unknown as ScanRunRepository;
    const { service, movies, provider } = createSubject(0.9, 'movie', 'First.mkv', runs);
    movies.listSuggestedMetadataTargets.mockReturnValue([{ id: 1, title: 'First', year: 2024, rawFilename: 'First.mkv' }, { id: 2, title: 'Second', year: 2024, rawFilename: 'Second.mkv' }]);
    provider.getDetails = vi.fn().mockRejectedValueOnce(new Error('Temporary provider failure')).mockResolvedValue({ providerId: '42', title: 'Example', year: 2024, overview: 'Overview', posterUrl: null, backdropUrl: null, genres: [], cast: [], rating: null, runtime: null, imdbId: null });

    expect(service.startBackfillAutoAccept()).toEqual(run);
    await vi.waitFor(() => expect(runs.finish).toHaveBeenCalledWith(17, 'completed', expect.stringContaining('1 title could not be accepted')));
    expect(runs.progress).toHaveBeenLastCalledWith(17, 2, 2, 1);
  });

  it('refreshes selected metadata in the background', async () => {
    const run = { id: 18, kind: 'metadata-refresh' as const, status: 'running' as const, startedAt: '2026-01-01T00:00:00.000Z', finishedAt: null, filesFound: 0, filesProcessed: 0, titlesAdded: 0, errorSummary: null };
    const runs = { active: vi.fn(), create: vi.fn().mockReturnValue(run), progress: vi.fn(), finish: vi.fn(), latest: vi.fn() } as unknown as ScanRunRepository;
    const { service, movies } = createSubject(0.9, 'movie', 'Example.mkv', runs);
    movies.listMetadataRefreshTargets.mockReturnValue([{ id: 1, title: 'Example', year: 2024, rawFilename: 'Example.mkv' }]);

    expect(service.startMetadataRefresh([1])).toEqual(run);
    await vi.waitFor(() => expect(runs.finish).toHaveBeenCalledWith(18, 'completed', null));
    expect(movies.resetForRematch).toHaveBeenCalledWith(1);
    expect(runs.progress).toHaveBeenLastCalledWith(18, 1, 1, 1);
  });

  it('backfills missing media types from saved IMDb metadata', async () => {
    const run = { id: 21, kind: 'metadata-type-backfill' as const, status: 'running' as const, startedAt: '2026-01-01T00:00:00.000Z', finishedAt: null, filesFound: 0, filesProcessed: 0, titlesAdded: 0, errorSummary: null };
    const runs = { active: vi.fn(), create: vi.fn().mockReturnValue(run), progress: vi.fn(), finish: vi.fn(), latest: vi.fn() } as unknown as ScanRunRepository;
    const { service, movies, provider } = createSubject(0.9, 'movie', 'Example.Show.S01E02.mkv', runs);
    movies.listMatchedWithoutMediaType.mockReturnValue([{ id: 1, title: 'Example Show', year: 2024, rawFilename: 'Example.Show.S01E02.mkv', metadataSource: 'tmdb', providerId: '42', mediaType: null, imdbId: 'tt1234567' }]);
    provider.getByImdbId = vi.fn().mockResolvedValue({ id: '42', title: 'Example Show', year: 2024, score: 1, mediaType: 'tv' });

    expect(service.startMissingMediaTypeBackfill()).toEqual(run);
    await vi.waitFor(() => expect(movies.setMetadataMediaType).toHaveBeenCalledWith(1, 'tv'));
    expect(runs.progress).toHaveBeenLastCalledWith(21, 1, 1, 1);
    expect(runs.finish).toHaveBeenCalledWith(21, 'completed', null);
  });

  it('refreshes an existing provider match directly instead of searching its filename title', async () => {
    const run = { id: 19, kind: 'metadata-refresh' as const, status: 'running' as const, startedAt: '2026-01-01T00:00:00.000Z', finishedAt: null, filesFound: 0, filesProcessed: 0, titlesAdded: 0, errorSummary: null };
    const runs = { active: vi.fn(), create: vi.fn().mockReturnValue(run), progress: vi.fn(), finish: vi.fn(), latest: vi.fn() } as unknown as ScanRunRepository;
    const { service, movies, provider } = createSubject(0.9, 'movie', '18_1_Irreversible_Irreversible.2002.mkv', runs);
    movies.listMetadataRefreshTargets.mockReturnValue([{ id: 1, title: '18 1 Irreversible Irreversible', year: 2002, rawFilename: '18_1_Irreversible_Irreversible.2002.mkv', metadataSource: 'tmdb', providerId: '42', mediaType: 'movie' }]);

    expect(service.startMetadataRefresh([1])).toEqual(run);

    await vi.waitFor(() => expect(runs.finish).toHaveBeenCalledWith(19, 'completed', null));
    expect(movies.resetForRematch).not.toHaveBeenCalled();
    expect(provider.getDetails).toHaveBeenCalledWith('42', 'movie');
    expect(movies.applyMetadata).toHaveBeenCalledWith(1, expect.objectContaining({ mediaType: 'movie', title: 'Example' }));
    expect(runs.progress).toHaveBeenLastCalledWith(19, 1, 1, 1);
  });

  it('preserves a manually selected episode during refresh and forces artwork fetching', async () => {
    const run = { id: 22, kind: 'metadata-refresh' as const, status: 'running' as const, startedAt: 'a', finishedAt: null, filesFound: 0, filesProcessed: 0, titlesAdded: 0, errorSummary: null };
    const runs = { active: vi.fn(), create: vi.fn().mockReturnValue(run), progress: vi.fn(), finish: vi.fn() } as unknown as ScanRunRepository;
    const { service, movies, provider, cache } = createSubject(0.9, 'tv', 'Wrong.S01E02.mkv', runs);
    movies.listMetadataRefreshTargets.mockReturnValue([{ id: 1, title: 'Example Show', year: 2024, rawFilename: 'Wrong.S01E02.mkv', metadataSource: 'tmdb', providerId: '42', mediaType: 'tv' }]);
    movies.get.mockReturnValue({ metadataStatus: 'matched', season: 3, episode: 7 });
    provider.getEpisodeDetails = vi.fn().mockResolvedValue({ title: 'Correct', overview: null, stillUrl: 'https://example.com/still.jpg', rating: null });
    service.startMetadataRefresh([1]);
    await vi.waitFor(() => expect(runs.finish).toHaveBeenCalledWith(22, 'completed', null));
    expect(provider.getEpisodeDetails).toHaveBeenCalledWith('42', 3, 7);
    expect(cache.cache).toHaveBeenCalledWith('https://example.com/still.jpg', 'posters', 'tmdb-42-s3e7', true);
    expect(movies.applyMetadata).toHaveBeenCalledWith(1, expect.objectContaining({ season: 3, episode: 7 }));
  });

  it('keeps saved metadata when refreshed artwork cannot be downloaded', async () => {
    const run = { id: 23, kind: 'metadata-refresh' as const, status: 'running' as const, startedAt: 'a', finishedAt: null, filesFound: 0, filesProcessed: 0, titlesAdded: 0, errorSummary: null };
    const runs = { active: vi.fn(), create: vi.fn().mockReturnValue(run), progress: vi.fn(), finish: vi.fn() } as unknown as ScanRunRepository;
    const { service, movies, cache } = createSubject(0.9, 'movie', 'Example.mkv', runs);
    movies.listMetadataRefreshTargets.mockReturnValue([{ id: 1, title: 'Example', year: 2024, rawFilename: 'Example.mkv', metadataSource: 'tmdb', providerId: '42', mediaType: 'movie' }]);
    cache.cache.mockRejectedValue(new Error('Artwork download failed'));
    service.startMetadataRefresh([1]);
    await vi.waitFor(() => expect(runs.finish).toHaveBeenCalledWith(23, 'completed', expect.stringContaining('Artwork download failed')));
    expect(movies.applyMetadata).not.toHaveBeenCalled();
    expect(movies.resetForRematch).not.toHaveBeenCalled();
  });

  it('falls back to a different provider by IMDb ID and reports a rate limit', async () => {
    const run = { id: 20, kind: 'metadata-refresh' as const, status: 'running' as const, startedAt: '2026-01-01T00:00:00.000Z', finishedAt: null, filesFound: 0, filesProcessed: 0, titlesAdded: 0, errorSummary: null };
    const runs = { active: vi.fn(), create: vi.fn().mockReturnValue(run), progress: vi.fn(), finish: vi.fn(), latest: vi.fn() } as unknown as ScanRunRepository;
    const { service, movies, provider: tmdb } = createSubject(0.9, 'tv', '3.Body.Problem.S01E04.mkv', runs);
    const omdb: MetadataProvider = { name: 'omdb', searchCandidates: vi.fn(), getDetails: vi.fn().mockRejectedValue(new Error('OMDb metadata lookup failed (401): Request limit reached!')) };
    tmdb.getByImdbId = vi.fn().mockResolvedValue({ id: '42', title: '3 Body Problem', year: 2024, score: 1, mediaType: 'tv' });
    tmdb.getEpisodeDetails = vi.fn().mockResolvedValue({ title: 'Our Lord', overview: null, stillUrl: null, rating: null });
    movies.listMetadataRefreshTargets.mockReturnValue([{ id: 1, title: '3 Body Problem WEB', year: null, rawFilename: '3.Body.Problem.S01E04.mkv', metadataSource: 'omdb', providerId: 'tt13016388', mediaType: null, imdbId: 'tt13016388' }]);
    vi.mocked(createMetadataProviders).mockReturnValue([tmdb, omdb]);

    expect(service.startMetadataRefresh([1])).toEqual(run);

    await vi.waitFor(() => expect(runs.finish).toHaveBeenCalledWith(20, 'completed', expect.stringContaining('Request limit reached')));
    expect(tmdb.getByImdbId).toHaveBeenCalledWith('tt13016388');
    expect(tmdb.getEpisodeDetails).toHaveBeenCalledWith('42', 1, 4);
    expect(movies.applyMetadata).toHaveBeenCalledWith(1, expect.objectContaining({ source: 'tmdb', mediaType: 'tv', title: 'Example · S1E4 · Our Lord' }));
    expect(runs.progress).toHaveBeenLastCalledWith(20, 1, 1, 1);
  });

  it('stops asking ratings for the rest of a run once the request limit is reached, and says so', async () => {
    const run = { id: 24, kind: 'metadata-refresh' as const, status: 'running' as const, startedAt: 'a', finishedAt: null, filesFound: 0, filesProcessed: 0, titlesAdded: 0, errorSummary: null };
    const runs = { active: vi.fn(), create: vi.fn().mockReturnValue(run), progress: vi.fn(), finish: vi.fn() } as unknown as ScanRunRepository;
    const extras = extrasRepo();
    const { service, movies, provider } = createSubject(0.9, 'movie', 'Example.mkv', runs, extras);
    provider.getDetails = vi.fn().mockResolvedValue({ providerId: '42', title: 'Example', year: 2024, overview: null, posterUrl: null, backdropUrl: null, genres: [], cast: [], rating: null, runtime: null, imdbId: 'tt0000042' });
    const ratings: RatingsProvider = { name: 'omdb', getRatings: vi.fn().mockRejectedValue(new RatingsLimitReachedError('OMDb', 'Request limit reached!')) };
    vi.mocked(createRatingsProviders).mockReturnValue([ratings]);
    // One worker per target would race; seven targets with four workers leave later titles after the limit is known.
    movies.listMetadataRefreshTargets.mockReturnValue(Array.from({ length: 7 }, (_, index) => ({ id: index + 1, title: `T${index}`, year: 2024, rawFilename: 'Example.mkv', metadataSource: 'tmdb', providerId: '42', mediaType: 'movie' })));

    service.startMetadataRefresh();

    await vi.waitFor(() => expect(runs.finish).toHaveBeenCalledWith(24, 'completed', expect.stringContaining('Ratings skipped for the rest of this run: OMDb Request limit reached!')));
    expect(extras.applyExtras).toHaveBeenCalledTimes(7);
    expect(extras.applyRatings).not.toHaveBeenCalled();
    expect(vi.mocked(ratings.getRatings).mock.calls.length).toBeLessThan(7);
    expect(runs.progress).toHaveBeenLastCalledWith(24, 7, 7, 7);
  });

  it('saves a TMDb match with its cast photos, logo, collection, trailer and ratings', async () => {
    const extras = extrasRepo();
    const { service, provider, cache } = createSubject(0.9, 'movie', 'Example.mkv', undefined, extras);
    const castMembers = Array.from({ length: 8 }, (_, index) => ({ name: `Actor ${index}`, photoUrl: `https://image.tmdb.org/t/p/w185/p${index}.jpg` }));
    provider.getDetails = vi.fn().mockResolvedValue({ providerId: '42', title: 'Example', year: 2024, overview: null, posterUrl: null, backdropUrl: null, genres: [], cast: [], rating: null, runtime: null, imdbId: 'tt0000042',
      castMembers, logoUrl: 'https://image.tmdb.org/t/p/w500/logo.png', collection: { id: 10, name: 'Saga' }, trailerKey: 'yt' });
    cache.cache.mockImplementation(async (url: string | null, kind: string, key: string) => url ? `${key}${kind === 'logos' ? '.png' : '.jpg'}` : null);
    const ratings: RatingsProvider = { name: 'omdb', getRatings: vi.fn().mockResolvedValue([{ source: 'imdb', value: 7.5, max: 10 }]) };
    vi.mocked(createRatingsProviders).mockReturnValue([ratings]);

    await expect(service.accept(1, 7)).resolves.toBe('ok');

    expect(cache.cache).toHaveBeenCalledWith('https://image.tmdb.org/t/p/w185/p0.jpg', 'people', 'tmdb-person-p0', false);
    expect(cache.cache).toHaveBeenCalledWith('https://image.tmdb.org/t/p/w500/logo.png', 'logos', 'tmdb-logo-logo', false);
    const saved = extras.applyExtras.mock.calls[0][1];
    expect(saved.castMembers).toHaveLength(8);
    expect(saved.castMembers[0]).toEqual({ name: 'Actor 0', photoUrl: '/media/people/tmdb-person-p0.jpg' });
    expect(saved).toEqual(expect.objectContaining({ logoFile: 'tmdb-logo-logo.png', collection: { id: 10, name: 'Saga' }, trailerKey: 'yt' }));
    expect(extras.ratingsDue).toHaveBeenCalledWith(1, 30);
    expect(extras.applyRatings).toHaveBeenCalledWith(1, [{ source: 'imdb', value: 7.5, max: 10 }]);
  });

  it('keeps the save when ratings fail, and does not ask again inside 30 days', async () => {
    const extras = extrasRepo();
    const { service, movies, provider } = createSubject(0.9, 'movie', 'Example.mkv', undefined, extras);
    provider.getDetails = vi.fn().mockResolvedValue({ providerId: '42', title: 'Example', year: 2024, overview: null, posterUrl: null, backdropUrl: null, genres: [], cast: [], rating: null, runtime: null, imdbId: 'tt0000042' });
    const ratings: RatingsProvider = { name: 'omdb', getRatings: vi.fn().mockRejectedValue(new Error('OMDb ratings lookup failed (500)')) };
    vi.mocked(createRatingsProviders).mockReturnValue([ratings]);

    await expect(service.accept(1, 7)).resolves.toBe('ok');
    expect(movies.applyMetadata).toHaveBeenCalledOnce();
    expect(extras.applyExtras).toHaveBeenCalledOnce();
    expect(extras.applyRatings).not.toHaveBeenCalled();
    expect(extras.deferRatings).toHaveBeenCalledWith(1, 30, 1);

    extras.ratingsDue.mockReturnValue(false);
    vi.mocked(ratings.getRatings).mockClear();
    await expect(service.accept(1, 7)).resolves.toBe('ok');
    expect(ratings.getRatings).not.toHaveBeenCalled();
  });
});
