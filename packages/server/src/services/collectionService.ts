import { hiddenDisplayTitle, type MissingCollectionPart, type MovieCollection, type Settings } from '@ottlib/shared';
import { createMetadataProviders } from '../providers/metadata/metadataProviders.js';
import type { CollectionPart } from '../providers/metadata/MetadataProvider.js';
import type { CollectionRepository } from '../repositories/collectionRepository.js';
import type { MovieRepository } from '../repositories/movieRepository.js';
import type { PosterCacheService } from './posterCacheService.js';

const partsMaxAgeMs = 30 * 24 * 60 * 60 * 1000;
/** A slow provider must not hold up the page: answer with the owned titles alone and cache the parts for next time. */
const fetchWaitMs = 4_000;
const posterLimit = 20;

export class CollectionService {
  public constructor(
    private readonly movies: MovieRepository, private readonly collections: CollectionRepository, private readonly posters: PosterCacheService,
    private readonly settings: () => Settings, private readonly now: () => Date = () => new Date(), private readonly waitMs = fetchWaitMs
  ) {}

  /** The collection a title belongs to, or null when it has none (or does not exist). */
  public async forMovie(movieId: number, profileId: number | undefined): Promise<MovieCollection | null> {
    const collection = this.movies.get(movieId)?.collection;
    if (!collection) return null;
    const titles = this.movies.listCollectionTitles(collection.id);
    const summaries = this.movies.summariesByIds(titles.map((title) => title.id), profileId);
    const owned = summaries.map((movie) => ({ ...movie, title: hiddenDisplayTitle(movie.title, movie.showKey), shelves: [] }));
    const parts = await this.partsFor(collection.id);
    const ownedProviderIds = new Set(titles.flatMap((title) => (title.source === 'tmdb' && title.providerId ? [title.providerId] : [])));
    const missingParts = (parts?.parts ?? []).filter((part) => !ownedProviderIds.has(part.id)).sort(byYear);
    return { id: collection.id, name: collection.name || parts?.name || '', owned, missing: await this.withPosters(missingParts) };
  }

  private async withPosters(parts: CollectionPart[]): Promise<MissingCollectionPart[]> {
    return Promise.all(parts.map(async (part, index) => {
      const file = index < posterLimit ? await this.posters.cache(part.posterUrl, 'posters', `tmdb-part-${part.id}`).catch(() => null) : null;
      return { tmdbId: part.id, title: part.title, year: part.year, posterUrl: file ? `/media/posters/${encodeURIComponent(file)}` : null };
    }));
  }

  private async partsFor(collectionId: number): Promise<{ name: string; parts: CollectionPart[] } | null> {
    const cached = this.collections.get(collectionId);
    if (cached && this.now().getTime() - Date.parse(cached.fetchedAt) < partsMaxAgeMs) return cached;
    return (await this.fetchWithin(collectionId)) ?? cached ?? null;
  }

  private async fetchWithin(collectionId: number): Promise<{ name: string; parts: CollectionPart[] } | null> {
    const source = createMetadataProviders(this.settings()).find((item) => item.getCollection);
    if (!source?.getCollection) return null;
    const request = source.getCollection(collectionId)
      .then((collection) => {
        if (!collection) return null;
        this.collections.put(collectionId, collection.name, collection.parts, this.now().toISOString());
        return collection;
      })
      .catch(() => null);
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), this.waitMs); });
    try { return await Promise.race([request, timeout]); } finally { clearTimeout(timer); }
  }
}

function byYear(a: CollectionPart, b: CollectionPart): number {
  return (a.year ?? Infinity) - (b.year ?? Infinity);
}
