import { hiddenDisplayTitle, type Recommendation, type Settings } from '@ottlib/shared';
import type { MovieRepository } from '../../repositories/movieRepository.js';
import type { RecommendationSignalRepository } from '../../repositories/recommendationSignalRepository.js';
import { createMetadataProviders } from '../../providers/metadata/metadataProviders.js';
import { genreFrequencies, rank, scoreCandidate, type PoolTitle, type ScoredTitle, type Signal } from './recommendationScoring.js';

const signalMaxAgeMs = 30 * 24 * 60 * 60 * 1000;
/** A slow provider must not hold up the page: answer from the library alone and cache the signal for next time. */
const signalWaitMs = 1_500;
const watchedFactor = 0.75;

export class RecommendationService {
  public constructor(private readonly movies: MovieRepository, private readonly signals: RecommendationSignalRepository, private readonly settings: () => Settings, private readonly now: () => Date = () => new Date()) {}

  public async forMovie(id: number, profileId: number | undefined, limit: number): Promise<Recommendation[]> {
    const pool = this.movies.listRecommendationPool();
    const anchor = pool.find((title) => title.id === id);
    if (!anchor) return [];
    const titles = onePerShow(pool);
    const frequencies = genreFrequencies(titles);
    const signal = await this.signalFor(anchor);
    const candidates = titles.filter((title) => title.id !== anchor.id && !sameTitle(anchor, title));
    const ranked = rank(candidates.map((candidate) => scoreCandidate(anchor, candidate, frequencies, titles.length, signal))).slice(0, limit * 2);
    return this.present(ranked, profileId, limit);
  }

  /** Titles this profile already watched are shown, just later: the point is something new to watch. */
  private present(ranked: ScoredTitle[], profileId: number | undefined, limit: number): Recommendation[] {
    const summaries = new Map(this.movies.summariesByIds(ranked.map((entry) => entry.title.id), profileId).map((item) => [item.id, item]));
    return ranked.flatMap((entry) => {
      const movie = summaries.get(entry.title.id);
      return movie ? [{ entry, movie, score: entry.score * (movie.watched ? watchedFactor : 1) }] : [];
    }).sort((a, b) => b.score - a.score).slice(0, limit)
      .map(({ entry, movie }) => ({ movie: { ...movie, title: hiddenDisplayTitle(movie.title, movie.showKey), shelves: [] }, reason: entry.reason }));
  }

  private async signalFor(anchor: PoolTitle): Promise<Signal | null> {
    if (!anchor.provider || !anchor.providerId || !anchor.mediaType) return null;
    const { provider, providerId, mediaType } = anchor;
    const cached = this.signals.get(provider, providerId, mediaType);
    const fresh = cached && this.now().getTime() - Date.parse(cached.fetchedAt) < signalMaxAgeMs;
    let ids = cached?.providerIds;
    if (!fresh) ids = (await this.fetchWithin(provider, providerId, mediaType)) ?? ids;
    if (!ids?.length) return null;
    const positions = new Map(ids.map((recommendedId, index) => [recommendedId, index]));
    return { size: ids.length, rankOf: (candidate) => (candidate.provider === provider && candidate.mediaType === mediaType && candidate.providerId ? positions.get(candidate.providerId) : undefined) };
  }

  private async fetchWithin(provider: string, providerId: string, mediaType: 'movie' | 'tv'): Promise<string[] | null> {
    const source = createMetadataProviders(this.settings()).find((item) => item.name === provider);
    if (!source?.getRecommendations) return null;
    const request = source.getRecommendations(providerId, mediaType)
      .then((ids) => { this.signals.put(provider, providerId, mediaType, ids, this.now().toISOString()); return ids; })
      .catch(() => null);
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), signalWaitMs); });
    try { return await Promise.race([request, timeout]); } finally { clearTimeout(timer); }
  }
}

/** A show appears once, as its first episode. */
function onePerShow(pool: PoolTitle[]): PoolTitle[] {
  const seen = new Set<string>();
  return pool.filter((title) => {
    if (!title.showKey) return true;
    if (seen.has(title.showKey)) return false;
    seen.add(title.showKey);
    return true;
  });
}

/** Other episodes of the same show, and other copies of the same film, are not recommendations. */
function sameTitle(anchor: PoolTitle, other: PoolTitle): boolean {
  if (anchor.showKey) return anchor.showKey === other.showKey;
  return anchor.imdbId !== null && anchor.imdbId === other.imdbId;
}
