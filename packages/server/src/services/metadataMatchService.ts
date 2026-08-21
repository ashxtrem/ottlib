import type { MetadataCandidate } from '../providers/metadata/MetadataProvider.js';
import { createMetadataProviders } from '../providers/metadata/metadataProviders.js';
import { MovieRepository } from '../repositories/movieRepository.js';
import { SettingRepository } from '../repositories/settingRepository.js';
import { PosterCacheService } from './posterCacheService.js';

export function extractImdbId(input: string): string | null {
  const match = input.trim().match(/tt\d{6,}/i);
  return match ? match[0].toLowerCase() : null;
}

export type AcceptOptions = { season?: number; episode?: number };

export class MetadataMatchService {
  public constructor(private readonly movies: MovieRepository, private readonly settings: SettingRepository, private readonly cache: PosterCacheService) {}

  public async suggest(movieId: number, searchTitle?: string): Promise<void> {
    const target = this.movies.metadataTarget(movieId); if (!target) return;
    const title = searchTitle?.trim() || target.title;
    const providers = createMetadataProviders(this.settings.get());
    if (!providers.length) { this.movies.markUnmatched(movieId); return; }
    let lastError: string | null = null;
    const candidates: Array<MetadataCandidate & { provider: string }> = [];
    for (const provider of providers) {
      try {
        const found = await provider.searchCandidates(title, target.year ?? undefined);
        candidates.push(...found.map((candidate) => ({ ...candidate, provider: provider.name })));
      } catch (error) { lastError = error instanceof Error ? error.message : 'Metadata lookup failed'; }
    }
    if (!candidates.length) { this.movies.markUnmatched(movieId, lastError); return; }
    const shortlist = candidates.sort((a, b) => b.score - a.score).slice(0, 5);
    this.movies.saveCandidates(movieId, shortlist.map((candidate) => ({ provider: candidate.provider, providerId: candidate.id, title: candidate.title, year: candidate.year, score: candidate.score, mediaType: candidate.mediaType })));
  }

  public async accept(movieId: number, candidateId: number, options: AcceptOptions = {}): Promise<'ok' | 'not-found' | 'needs-episode'> {
    const candidate = this.movies.getCandidate(movieId, candidateId); if (!candidate) return 'not-found';
    const providers = createMetadataProviders(this.settings.get());
    const provider = providers.find((item) => item.name === candidate.provider); if (!provider) return 'not-found';
    const show = await provider.getDetails(candidate.providerId, candidate.mediaType); if (!show) return 'not-found';

    let title = show.title; let overview = show.overview; let posterUrl = show.posterUrl; let rating = show.rating;
    if (candidate.mediaType === 'tv') {
      if (!options.season || !options.episode) return 'needs-episode';
      if (!provider.getEpisodeDetails) return 'not-found';
      const ep = await provider.getEpisodeDetails(candidate.providerId, options.season, options.episode); if (!ep) return 'not-found';
      title = `${show.title} · S${options.season}E${options.episode}${ep.title ? ` · ${ep.title}` : ''}`;
      overview = ep.overview ?? show.overview; posterUrl = ep.stillUrl ?? show.posterUrl; rating = ep.rating ?? show.rating;
    }

    const prefix = `${provider.name}-${show.providerId}${candidate.mediaType === 'tv' ? `-s${options.season}e${options.episode}` : ''}`;
    const [posterFile, backdropFile] = await Promise.all([
      this.cache.cache(posterUrl, 'posters', prefix), this.cache.cache(show.backdropUrl, 'backdrops', prefix)
    ]);
    this.movies.applyMetadata(movieId, { source: provider.name, providerId: show.providerId, title, year: show.year, overview, posterFile, backdropFile, genres: show.genres, cast: show.cast, rating, runtime: show.runtime, imdbId: show.imdbId });
    return 'ok';
  }

  public async suggestFromImdb(movieId: number, rawInput: string): Promise<'ok' | 'invalid-id' | 'not-found'> {
    const imdbId = extractImdbId(rawInput); if (!imdbId) return 'invalid-id';
    const providers = createMetadataProviders(this.settings.get());
    for (const provider of providers) {
      if (!provider.getByImdbId) continue;
      try {
        const candidate = await provider.getByImdbId(imdbId); if (!candidate) continue;
        this.movies.saveCandidates(movieId, [{ provider: provider.name, providerId: candidate.id, title: candidate.title, year: candidate.year, score: 1, mediaType: candidate.mediaType }]);
        return 'ok';
      } catch { continue; }
    }
    return 'not-found';
  }

  public reject(movieId: number): void {
    this.movies.markUnmatched(movieId);
  }
}
