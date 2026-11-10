import { basename, extname } from 'node:path';
import type { CastMember } from '@ottlib/shared';
import type { MovieMetadata } from '../providers/metadata/MetadataProvider.js';
import { RatingsLimitReachedError } from '../providers/metadata/RatingsProvider.js';
import { createRatingsProviders } from '../providers/metadata/ratingsProviders.js';
import type { MovieExtrasRepository } from '../repositories/movieExtrasRepository.js';
import type { SettingRepository } from '../repositories/settingRepository.js';
import type { PosterCacheService } from './posterCacheService.js';

export const ratingsRefreshDays = 30;
/** After a failed ratings lookup the title is asked again after this many days. */
export const ratingsRetryDays = 1;

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
  public constructor(
    private readonly extras: MovieExtrasRepository, private readonly cache: PosterCacheService, private readonly settings: SettingRepository,
    private readonly log: (message: string) => void = () => undefined
  ) {}

  /**
   * With `keepStored` (the same title refreshed) a value the provider did not bring this time (no logo, a failed download,
   * OMDb with no extras at all) leaves the stored one in place; a different title replaces everything.
   */
  public async save(movieId: number, providerName: string, show: MovieMetadata, run: RatingsRun, keepStored = true): Promise<void> {
    const [castMembers, logoFile] = await Promise.all([this.cacheCast(providerName, show), this.cacheFile(show.logoUrl ?? null, 'logos', `${providerName}-logo`)]);
    const stored = keepStored ? this.extras.extrasFor(movieId) : undefined;
    this.extras.applyExtras(movieId, {
      castMembers: this.mergeCast(castMembers, stored?.castMembers ?? []), logoFile: logoFile ?? stored?.logoFile ?? null,
      collection: show.collection ?? stored?.collection ?? null, trailerKey: show.trailerKey ?? stored?.trailerKey ?? null
    });
    await this.saveRatings(movieId, show.imdbId, run);
  }

  /** New cast wins; with none, the stored cast stays; a photo that failed to download keeps the stored photo of the same person. */
  private mergeCast(fresh: CastMember[], stored: CastMember[]): CastMember[] {
    if (!fresh.length) return stored;
    const photos = new Map(stored.flatMap((member) => member.photoUrl ? [[member.name, member.photoUrl] as const] : []));
    return fresh.map((member) => member.photoUrl ? member : { name: member.name, photoUrl: photos.get(member.name) ?? null });
  }

  private cacheCast(providerName: string, show: MovieMetadata): Promise<CastMember[]> {
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
    let failed = false;
    for (const provider of createRatingsProviders(settings)) {
      try {
        this.extras.applyRatings(movieId, await provider.getRatings(imdbId));
        return;
      } catch (error) {
        if (error instanceof RatingsLimitReachedError) { run.limitReached = true; run.limitMessage = error.message; return; }
        failed = true;
        this.log(`Ratings from ${provider.name} failed for ${imdbId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    // Every provider refused this title: wait before asking again instead of on every save.
    if (failed) this.extras.deferRatings(movieId, ratingsRefreshDays, ratingsRetryDays);
  }
}
