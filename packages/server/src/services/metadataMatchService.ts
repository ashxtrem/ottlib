import type { MetadataCandidate } from '../providers/metadata/MetadataProvider.js';
import type { MatchCandidate } from '@ottlib/shared';
import { createMetadataProviders } from '../providers/metadata/metadataProviders.js';
import { MovieRepository } from '../repositories/movieRepository.js';
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
type AutoAcceptOutcome = { accepted: true } | { accepted: false; error?: string };
type SuggestedTarget = { id: number; title: string; rawFilename: string };

const autoAcceptConcurrency = 4;

function detectSeasonEpisode(filename: string): AcceptOptions | null {
  const match = filename.match(/s(\d{1,2})[\s._-]?e(\d{1,3})/i) ?? filename.match(/\b(\d{1,2})x(\d{2,3})\b/i) ?? filename.match(/season\s?(\d{1,2})\s?episode\s?(\d{1,3})/i);
  return match ? { season: Number(match[1]), episode: Number(match[2]) } : null;
}

export class MetadataMatchService {
  public constructor(private readonly movies: MovieRepository, private readonly settings: SettingRepository, private readonly cache: PosterCacheService, private readonly runs?: ScanRunRepository) {}

  public async suggest(movieId: number, searchTitle?: string, options: SuggestOptions = {}): Promise<void> {
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
    if (options.autoAccept) await this.autoAcceptTopCandidate(movieId, target.rawFilename);
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
    const episode = candidate.mediaType === 'tv' ? detectSeasonEpisode(rawFilename) : {};
    if (candidate.mediaType === 'tv' && !episode) return undefined;
    return { candidate, episode: episode ?? {} };
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
