import { basename, extname } from 'node:path';
import type { MovieMetadata } from '../providers/metadata/MetadataProvider.js';
import { RatingsLimitReachedError } from '../providers/metadata/RatingsProvider.js';
import { createRatingsProviders } from '../providers/metadata/ratingsProviders.js';
import type { MovieExtrasRepository, StoredCastMember } from '../repositories/movieExtrasRepository.js';
import type { SettingRepository } from '../repositories/settingRepository.js';
import type { PosterCacheService } from './posterCacheService.js';

export const ratingsRefreshDays = 30;

/** Shared by every save of one run: once a ratings provider's quota is used up, the run stops asking it. */
export interface RatingsRun { limitReached: boolean; limitMessage: string | null }
export const newRatingsRun = (): RatingsRun => ({ limitReached: false, limitMessage: null });
export const ratingsLimitNotice = (run: RatingsRun): string | null =>
  run.limitReached ? `Ratings skipped for the rest of this run: ${run.limitMessage ?? 'request limit reached'}` : null;

/** A cached file name that follows the remote file, so a title sharing it reuses the same file and a changed image gets a new name. */
function stableKey(prefix: string, url: string): string {
  const path = new URL(url).pathname;
  return `${prefix}-${basename(path, extname(path))}`;
}

// Saves what a metadata match brings besides the core fields: cast photos, logo, collection, trailer and outside ratings.
export class TitleExtrasService {
  public constructor(private readonly extras: MovieExtrasRepository, private readonly cache: PosterCacheService, private readonly settings: SettingRepository) {}

  public async save(movieId: number, providerName: string, show: MovieMetadata, run: RatingsRun): Promise<void> {
    const [castMembers, logoFile] = await Promise.all([this.cacheCast(providerName, show), this.cacheFile(show.logoUrl ?? null, 'logos', `${providerName}-logo`)]);
    this.extras.applyExtras(movieId, { castMembers, logoFile, collection: show.collection ?? null, trailerKey: show.trailerKey ?? null });
    await this.saveRatings(movieId, show.imdbId, run);
  }

  private cacheCast(providerName: string, show: MovieMetadata): Promise<StoredCastMember[]> {
    return Promise.all((show.castMembers ?? []).map(async (member) => {
      const file = await this.cacheFile(member.photoUrl, 'people', `${providerName}-person`);
      return { name: member.name, photoUrl: file ? `/media/people/${file}` : null };
    }));
  }

  /** Never refreshes: the name already changes with the remote path. A failed download leaves the image out. */
  private async cacheFile(url: string | null, kind: 'logos' | 'people', prefix: string): Promise<string | null> {
    if (!url) return null;
    try { return await this.cache.cache(url, kind, stableKey(prefix, url), false); } catch { return null; }
  }

  /** A ratings failure never fails the save; a used-up quota stops ratings for the rest of the run. */
  private async saveRatings(movieId: number, imdbId: string | null, run: RatingsRun): Promise<void> {
    if (!imdbId || run.limitReached || !this.extras.ratingsDue(movieId, ratingsRefreshDays)) return;
    const settings = this.settings.get(); if (!settings) return;
    for (const provider of createRatingsProviders(settings)) {
      try {
        this.extras.applyRatings(movieId, await provider.getRatings(imdbId));
        return;
      } catch (error) {
        if (error instanceof RatingsLimitReachedError) { run.limitReached = true; run.limitMessage = error.message; return; }
      }
    }
  }
}
