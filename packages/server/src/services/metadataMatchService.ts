import type { MediaType, MetadataCandidate, MetadataProvider, MovieMetadata } from '../providers/metadata/MetadataProvider.js';
import type { ManualMatchCandidate, MatchCandidate } from '@ottlib/shared';
import { createMetadataProviders } from '../providers/metadata/metadataProviders.js';
import { MovieRepository, type MetadataTarget } from '../repositories/movieRepository.js';
import { ScanRunRepository } from '../repositories/scanRunRepository.js';
import { SettingRepository } from '../repositories/settingRepository.js';
import { PosterCacheService } from './posterCacheService.js';
import type { ScanRun } from '@ottlib/shared';

export const autoAcceptScoreThreshold = 0.75;

export function extractImdbId(input: string): string | null {
  const match = input.trim().match(/tt\d{6,}/i);
  return match ? match[0].toLowerCase() : null;
}

export type AcceptOptions = { season?: number; episode?: number };
export type SuggestOptions = { autoAccept?: boolean };
export type ManualMatchSelection = Pick<ManualMatchCandidate, 'provider' | 'providerId' | 'mediaType' | 'season' | 'episode'>;
type AutoAcceptOutcome = { accepted: true } | { accepted: false; error?: string };
type SuggestedTarget = { id: number; title: string; rawFilename: string };
type MetadataRefreshOutcome = { refreshed: boolean; notice?: string };

const autoAcceptConcurrency = 4;
const mediaTypeBackfillConcurrency = 2;

function detectSeasonEpisode(filename: string): AcceptOptions | null {
  const match = filename.match(/s(\d{1,2})[\s._-]?e(\d{1,3})/i) ?? filename.match(/\b(\d{1,2})x(\d{2,3})\b/i) ?? filename.match(/season\s?(\d{1,2})\s?episode\s?(\d{1,3})/i);
  return match ? { season: Number(match[1]), episode: Number(match[2]) } : null;
}

export class MetadataMatchService {
  public constructor(private readonly movies: MovieRepository, private readonly settings: SettingRepository, private readonly cache: PosterCacheService, private readonly runs?: ScanRunRepository) {}

  public async suggest(movieId: number, searchTitle?: string, options: SuggestOptions = {}): Promise<void> {
    const target = this.movies.metadataTarget(movieId); if (!target) return;
    const { shortlist, error } = await this.findCandidates(target, searchTitle);
    if (!shortlist.length) { this.movies.markUnmatched(movieId, error); return; }
    this.movies.saveCandidates(movieId, shortlist);
    if (options.autoAccept) await this.autoAcceptTopCandidate(movieId, target.rawFilename);
  }

  public async findManualCandidates(movieId: number, searchTitle?: string): Promise<ManualMatchCandidate[]> {
    const target = this.movies.metadataTarget(movieId); if (!target) return [];
    const { shortlist, error } = await this.findCandidates(target, searchTitle);
    if (!shortlist.length && error) throw new Error(error);
    return shortlist;
  }

  private async findCandidates(target: MetadataTarget, searchTitle?: string): Promise<{ shortlist: ManualMatchCandidate[]; error: string | null }> {
    const title = searchTitle?.trim() || target.title;
    const providers = createMetadataProviders(this.settings.get());
    if (!providers.length) return { shortlist: [], error: 'Add a metadata provider API key in Settings first.' };
    let lastError: string | null = null;
    const candidates: Array<MetadataCandidate & { provider: string }> = [];
    for (const provider of providers) {
      try {
        const found = await provider.searchCandidates(title, target.year ?? undefined);
        candidates.push(...found.map((candidate) => ({ ...candidate, provider: provider.name })));
      } catch (error) { lastError = error instanceof Error ? error.message : 'Metadata lookup failed'; }
    }
    const shortlist = candidates.sort((a, b) => b.score - a.score).slice(0, 5).map((candidate) => ({ provider: candidate.provider, providerId: candidate.id, title: candidate.title, year: candidate.year, score: candidate.score, mediaType: candidate.mediaType, season: candidate.season, episode: candidate.episode }));
    return { shortlist, error: lastError };
  }

  public countAutoAcceptableSuggestions(): number {
    return this.autoAcceptTargets().length;
  }

  public startBackfillAutoAccept(): ScanRun {
    if (!this.runs) throw new Error('Auto-accept runs are unavailable');
    const active = this.runs.active('auto-accept'); if (active) return active;
    const targets = this.autoAcceptTargets(); const run = this.runs.create('auto-accept');
    this.runs.progress(run.id, targets.length, 0, 0); void this.executeBackfill(run.id, targets); return run;
  }

  public backfillAutoAcceptStatus(): ScanRun | { status: 'idle' } {
    if (!this.runs) return { status: 'idle' };
    return this.runs.active('auto-accept') ?? this.runs.latest('auto-accept') ?? { status: 'idle' };
  }

  public startMetadataRefresh(movieIds?: number[]): ScanRun {
    if (!this.runs) throw new Error('Metadata refresh runs are unavailable');
    const active = this.runs.active('metadata-refresh'); if (active) return active;
    const targets = this.movies.listMetadataRefreshTargets(movieIds); const run = this.runs.create('metadata-refresh');
    this.runs.progress(run.id, targets.length, 0, 0); void this.executeMetadataRefresh(run.id, targets); return run;
  }

  public metadataRefreshStatus(): ScanRun | { status: 'idle' } {
    if (!this.runs) return { status: 'idle' };
    return this.runs.active('metadata-refresh') ?? this.runs.latest('metadata-refresh') ?? { status: 'idle' };
  }

  public startMissingMediaTypeBackfill(): ScanRun | undefined {
    if (!this.runs) return undefined;
    const active = this.runs.active('metadata-type-backfill'); if (active) return active;
    const targets = this.movies.listMatchedWithoutMediaType(); if (!targets.length) return undefined;
    const providers = createMetadataProviders(this.settings.get()); if (!providers.length) return undefined;
    const run = this.runs.create('metadata-type-backfill');
    this.runs.progress(run.id, targets.length, 0, 0);
    void this.executeMediaTypeBackfill(run.id, targets, providers);
    return run;
  }

  public async backfillAutoAccept(): Promise<{ accepted: number; stillNeedsReview: number }> {
    const { accepted } = await this.acceptTargets(this.autoAcceptTargets());
    return { accepted, stillNeedsReview: this.movies.countSuggestedMetadataTargets() };
  }

  private autoAcceptTargets(): SuggestedTarget[] {
    return this.movies.listSuggestedMetadataTargets().filter((target) => this.autoAcceptCandidate(target.id, target.rawFilename) !== undefined);
  }

  private async executeBackfill(runId: number, targets: SuggestedTarget[]): Promise<void> {
    if (!this.runs) return;
    try {
      const { failures } = await this.acceptTargets(targets, (processed, acceptedCount) => this.runs?.progress(runId, targets.length, processed, acceptedCount));
      const summary = failures.length ? `${failures.length} ${failures.length === 1 ? 'title could' : 'titles could'} not be accepted.\n${failures.slice(0, 5).join('\n')}` : null;
      this.runs.finish(runId, 'completed', summary);
    } catch (error) {
      this.runs.finish(runId, 'failed', error instanceof Error ? error.message : 'Automatic acceptance failed');
    }
  }

  private async executeMetadataRefresh(runId: number, targets: MetadataTarget[]): Promise<void> {
    if (!this.runs) return;
    let next = 0; let processed = 0; let matched = 0; const notices: string[] = [];
    const worker = async () => {
      while (next < targets.length) {
        const target = targets[next++];
        try {
          if (target.metadataSource && target.providerId) {
            const result = await this.refreshMatchedMetadata(target);
            if (result.refreshed) matched += 1;
            if (result.notice) notices.push(`${target.title}: ${result.notice}`);
          } else {
            this.movies.resetForRematch(target.id);
            await this.suggest(target.id, target.title, { autoAccept: true });
            if (this.movies.get(target.id)?.metadataStatus === 'matched') matched += 1;
          }
        } catch (error) {
          notices.push(`${target.title}: ${error instanceof Error ? error.message : 'Metadata refresh failed'}`);
        }
        processed += 1; this.runs?.progress(runId, targets.length, processed, matched);
      }
    };
    try {
      await Promise.all(Array.from({ length: Math.min(autoAcceptConcurrency, targets.length) }, worker));
      const summary = notices.length ? notices.slice(0, 5).join('\n') : null;
      this.runs.finish(runId, 'completed', summary);
    } catch (error) {
      this.runs.finish(runId, 'failed', error instanceof Error ? error.message : 'Metadata refresh failed');
    }
  }

  private async executeMediaTypeBackfill(runId: number, targets: MetadataTarget[], providers: MetadataProvider[]): Promise<void> {
    if (!this.runs) return;
    let next = 0; let processed = 0; let classified = 0; const failures: string[] = [];
    const worker = async () => {
      while (next < targets.length) {
        const target = targets[next++];
        try {
          const mediaType = await this.resolveMediaType(target, providers);
          if (mediaType) { this.movies.setMetadataMediaType(target.id, mediaType); classified += 1; }
          else failures.push(`${target.title}: unable to determine media type`);
        } catch (error) {
          failures.push(`${target.title}: ${error instanceof Error ? error.message : 'metadata lookup failed'}`);
        }
        processed += 1; this.runs?.progress(runId, targets.length, processed, classified);
      }
    };
    try {
      await Promise.all(Array.from({ length: Math.min(mediaTypeBackfillConcurrency, targets.length) }, worker));
      const summary = failures.length ? `${failures.length} ${failures.length === 1 ? 'title could' : 'titles could'} not be classified.\n${failures.slice(0, 5).join('\n')}` : null;
      this.runs.finish(runId, 'completed', summary);
    } catch (error) {
      this.runs.finish(runId, 'failed', error instanceof Error ? error.message : 'Media-type backfill failed');
    }
  }

  private async acceptTargets(targets: SuggestedTarget[], onProgress?: (processed: number, accepted: number) => void): Promise<{ accepted: number; failures: string[] }> {
    let next = 0; let processed = 0; let accepted = 0; const failures: string[] = [];
    const worker = async () => {
      while (next < targets.length) {
        const target = targets[next++]; const result = await this.autoAcceptTopCandidate(target.id, target.rawFilename);
        if (result.accepted) accepted += 1;
        else if (result.error) failures.push(`${target.title}: ${result.error}`);
        processed += 1; onProgress?.(processed, accepted);
      }
    };
    await Promise.all(Array.from({ length: Math.min(autoAcceptConcurrency, targets.length) }, worker));
    return { accepted, failures };
  }

  private autoAcceptCandidate(movieId: number, rawFilename: string) {
    const candidate = this.movies.getCandidates(movieId).reduce<MatchCandidate | undefined>((top, item) => !top || item.score > top.score ? item : top, undefined);
    if (!candidate || candidate.score <= autoAcceptScoreThreshold) return undefined;
    const detectedEpisode = candidate.mediaType === 'tv' ? detectSeasonEpisode(rawFilename) : null;
    const episode = candidate.mediaType === 'tv' ? { season: candidate.season ?? detectedEpisode?.season, episode: candidate.episode ?? detectedEpisode?.episode } : {};
    if (candidate.mediaType === 'tv' && (!episode.season || !episode.episode)) return undefined;
    return { candidate, episode };
  }

  private async autoAcceptTopCandidate(movieId: number, rawFilename: string): Promise<AutoAcceptOutcome> {
    const match = this.autoAcceptCandidate(movieId, rawFilename); if (!match) return { accepted: false };
    try {
      const result = await this.accept(movieId, match.candidate.id, match.episode);
      return result === 'ok' ? { accepted: true } : { accepted: false, error: 'Saved candidate is no longer available' };
    } catch (error) {
      return { accepted: false, error: error instanceof Error ? error.message : 'Metadata lookup failed' };
    }
  }

  public async accept(movieId: number, candidateId: number, options: AcceptOptions = {}): Promise<'ok' | 'not-found' | 'needs-episode'> {
    const candidate = this.movies.getCandidate(movieId, candidateId); if (!candidate) return 'not-found';
    return this.acceptSelection(movieId, candidate, options);
  }

  public async acceptManualCandidate(movieId: number, candidate: ManualMatchSelection, options: AcceptOptions = {}): Promise<'ok' | 'not-found' | 'needs-episode'> {
    return this.acceptSelection(movieId, candidate, options);
  }

  private async acceptSelection(movieId: number, candidate: ManualMatchSelection, options: AcceptOptions): Promise<'ok' | 'not-found' | 'needs-episode'> {
    const providers = createMetadataProviders(this.settings.get());
    const provider = providers.find((item) => item.name === candidate.provider); if (!provider) return 'not-found';
    const show = await provider.getDetails(candidate.providerId, candidate.mediaType); if (!show) return 'not-found';

    const season = options.season ?? candidate.season; const episodeNumber = options.episode ?? candidate.episode;
    if (candidate.mediaType === 'tv' && (!season || !episodeNumber)) return 'needs-episode';
    await this.saveMetadata(movieId, provider, candidate.mediaType, show, { season, episode: episodeNumber });
    return 'ok';
  }

  private async refreshMatchedMetadata(target: MetadataTarget): Promise<MetadataRefreshOutcome> {
    const providers = createMetadataProviders(this.settings.get());
    const provider = providers.find((item) => item.name === target.metadataSource);
    const notices: string[] = [];
    const detectedEpisode = detectSeasonEpisode(target.rawFilename);
    const mediaTypes: Array<'movie' | 'tv'> = target.mediaType ? [target.mediaType] : detectedEpisode ? ['tv', 'movie'] : ['movie', 'tv'];
    if (provider && target.providerId) {
      try {
        if (await this.refreshFromProvider(target, provider, target.providerId, mediaTypes, detectedEpisode ?? {})) return { refreshed: true };
        notices.push(`${provider.name} returned no matching metadata`);
      } catch (error) {
        notices.push(error instanceof Error ? error.message : `${provider.name} metadata lookup failed`);
      }
    }
    if (target.imdbId) {
      for (const fallback of providers) {
        if (fallback.name === target.metadataSource || !fallback.getByImdbId) continue;
        try {
          const candidate = await fallback.getByImdbId(target.imdbId);
          if (!candidate) { notices.push(`${fallback.name} could not find IMDb ID ${target.imdbId}`); continue; }
          const episode = candidate.mediaType === 'tv' ? { season: candidate.season ?? detectedEpisode?.season, episode: candidate.episode ?? detectedEpisode?.episode } : {};
          if (await this.refreshFromProvider(target, fallback, candidate.id, [candidate.mediaType], episode)) {
            const fallbackNotice = `Refreshed using ${fallback.name.toUpperCase()} via IMDb ID.`;
            return { refreshed: true, notice: notices.length ? `${notices.join('; ')}. ${fallbackNotice}` : fallbackNotice };
          }
          notices.push(`${fallback.name} returned no matching metadata`);
        } catch (error) {
          notices.push(error instanceof Error ? error.message : `${fallback.name} IMDb lookup failed`);
        }
      }
    }
    return { refreshed: false, notice: notices.join('; ') || 'Saved metadata provider is unavailable' };
  }

  private async refreshFromProvider(target: MetadataTarget, provider: MetadataProvider, providerId: string, mediaTypes: Array<'movie' | 'tv'>, episode: AcceptOptions): Promise<boolean> {
    for (const mediaType of mediaTypes) {
      const show = await provider.getDetails(providerId, mediaType);
      if (!show) continue;
      await this.saveMetadata(target.id, provider, mediaType, show, mediaType === 'tv' ? episode : {});
      return true;
    }
    return false;
  }

  private async resolveMediaType(target: MetadataTarget, providers: MetadataProvider[]): Promise<MediaType | undefined> {
    const imdbId = target.imdbId ?? (target.metadataSource === 'omdb' ? target.providerId : null);
    if (imdbId) {
      for (const provider of providers) {
        if (!provider.getByImdbId) continue;
        try {
          const match = await provider.getByImdbId(imdbId);
          if (match) return match.mediaType;
        } catch { continue; }
      }
    }

    const provider = providers.find((item) => item.name === target.metadataSource);
    if (!provider || !target.providerId || provider.name === 'omdb') return undefined;
    const mediaTypes: MediaType[] = detectSeasonEpisode(target.rawFilename) ? ['tv', 'movie'] : ['movie', 'tv'];
    for (const mediaType of mediaTypes) {
      try {
        if (await provider.getDetails(target.providerId, mediaType)) return mediaType;
      } catch { continue; }
    }
    return undefined;
  }

  private async saveMetadata(movieId: number, provider: MetadataProvider, mediaType: 'movie' | 'tv', show: MovieMetadata, options: AcceptOptions): Promise<void> {
    let title = show.title; let overview = show.overview; let posterUrl = show.posterUrl; let rating = show.rating;
    if (mediaType === 'tv' && options.season && options.episode) {
      const episode = provider.getEpisodeDetails ? await provider.getEpisodeDetails(show.providerId, options.season, options.episode) : null;
      title = `${show.title} · S${options.season}E${options.episode}${episode?.title ? ` · ${episode.title}` : ''}`;
      overview = episode?.overview ?? show.overview; posterUrl = episode?.stillUrl ?? show.posterUrl; rating = episode?.rating ?? show.rating;
    }

    const prefix = `${provider.name}-${show.providerId}${mediaType === 'tv' && options.season && options.episode ? `-s${options.season}e${options.episode}` : ''}`;
    const [posterFile, backdropFile] = await Promise.all([
      this.cache.cache(posterUrl, 'posters', prefix), this.cache.cache(show.backdropUrl, 'backdrops', prefix)
    ]);
    this.movies.applyMetadata(movieId, { source: provider.name, providerId: show.providerId, mediaType, season: mediaType === 'tv' ? options.season ?? null : null, episode: mediaType === 'tv' ? options.episode ?? null : null, title, year: show.year, overview, posterFile, backdropFile, genres: show.genres, cast: show.cast, rating, runtime: show.runtime, imdbId: show.imdbId });
  }

  public async suggestFromImdb(movieId: number, rawInput: string): Promise<'ok' | 'invalid-id' | 'not-found'> {
    const imdbId = extractImdbId(rawInput); if (!imdbId) return 'invalid-id';
    const providers = createMetadataProviders(this.settings.get());
    for (const provider of providers) {
      if (!provider.getByImdbId) continue;
      try {
        const candidate = await provider.getByImdbId(imdbId); if (!candidate) continue;
        this.movies.saveCandidates(movieId, [{ provider: provider.name, providerId: candidate.id, title: candidate.title, year: candidate.year, score: 1, mediaType: candidate.mediaType, season: candidate.season, episode: candidate.episode }]);
        return 'ok';
      } catch { continue; }
    }
    return 'not-found';
  }

  public reject(movieId: number): void {
    this.movies.markUnmatched(movieId);
  }
}
