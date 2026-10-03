import { randomUUID } from 'node:crypto';
import type { SubtitleOptions, SubtitleSearch, SubtitleSearchResponse } from '@ottlib/shared/subtitles';
import { subtitleLanguages } from '@ottlib/shared/subtitles';
import { subtitleFormats, subtitleLanguageAliases, subtitleLimits } from '../../config/subtitles.js';
import type { SubtitleProvider, ProviderSubtitle, SubtitleQuery } from '../../providers/subtitles/SubtitleProvider.js';
import { MovieRepository } from '../../repositories/movieRepository.js';
import { SettingRepository } from '../../repositories/settingRepository.js';
import { PlaybackService } from '../playbackService.js';
import { SubtitleLibraryService } from './subtitleLibraryService.js';
import { movieHash } from './movieHash.js';

interface CachedResult { movieId: number; result: ProviderSubtitle; provider: SubtitleProvider; expires: number }
export class SubtitleService {
  private readonly results = new Map<string, CachedResult>();
  constructor(private readonly providers: SubtitleProvider[], private readonly movies: MovieRepository,
    private readonly settings: SettingRepository, private readonly playback: PlaybackService, private readonly library: SubtitleLibraryService) {}
  options(): SubtitleOptions {
    return { providers: this.providers.map(provider => ({ name: provider.name, configured: provider.configured() })),
      languages: [...subtitleLanguages], preferredLanguages: this.settings.get().subtitleSearchLanguages };
  }
  async search(movieId: number, input: SubtitleSearch): Promise<SubtitleSearchResponse> {
    this.prune();
    const file = await this.playback.movieFile(movieId); const movie = this.movies.get(movieId)!;
    const providers = this.providers.filter(provider => provider.configured());
    if (!providers.length) return { results: [], warnings: ['Configure OpenSubtitles or SubDL in the web app’s Settings to download subtitles.'] };
    const query: SubtitleQuery = {
      mode: input.mode, title: input.mode === 'manual' ? input.query! : movie.title.replace(/\s*·\s*S\d+E\d+\s*$/i, ''),
      filename: file.filename, imdbId: input.mode === 'auto' ? movie.imdbId : null,
      year: input.year !== undefined ? input.year : movie.year,
      season: input.season !== undefined ? input.season : movie.season,
      episode: input.episode !== undefined ? input.episode : movie.episode,
      type: movie.mediaType === 'tv' || input.season || input.episode ? 'tv' : 'movie',
      languages: [...new Set(input.languages.map(language => subtitleLanguageAliases[language] ?? language))],
      hash: input.mode === 'auto' ? await movieHash(file.path) : undefined,
    };
    const saved = await this.library.list(movieId); const warnings: string[] = [];
    const searches = await Promise.allSettled(providers.map(provider => provider.search({ ...query, languages: [...query.languages] })));
    const seen = new Set<string>();
    const results = searches.flatMap((search, index) => {
      const provider = providers[index];
      if (search.status === 'rejected') {
        warnings.push(`${provider.name}: ${search.reason instanceof Error ? search.reason.message : 'Search failed'}`); return [];
      }
      return search.value.filter(result => {
        result.language = subtitleLanguageAliases[result.language.toLowerCase()] ?? result.language.toLowerCase();
        const identity = `${provider.name}:${result.remoteId}`;
        if (!subtitleFormats[result.format] || !query.languages.includes(result.language) || seen.has(identity)) return false;
        seen.add(identity); return true;
      }).slice(0, subtitleLimits.maxResultsPerProvider).map(result => {
        const match = query.filename.toLowerCase().replace(/\.[^.]+$/, '');
        const release = result.releaseName.toLowerCase().replace(/\.(srt|ass|ssa|vtt)$/, '');
        if (match === release) result.score = Math.max(0.95, result.score);
        const id = randomUUID();
        this.results.set(id, { movieId, result, provider, expires: Date.now() + subtitleLimits.searchTtlMs });
        const { remoteId: _remoteId, downloadUrl: _url, ...publicResult } = result;
        return { ...publicResult, id, downloaded: saved.some(item => item.provider === provider.name && item.remote_id === result.remoteId) };
      });
    });
    return { results: results.sort((a, b) => Number(b.hashMatch) - Number(a.hashMatch) || b.score - a.score || b.downloads - a.downloads), warnings };
  }
  async download(movieId: number, resultId: string) {
    const cached = this.results.get(resultId);
    if (!cached || cached.movieId !== movieId || cached.expires <= Date.now()) throw new Error('This result expired. Search again before downloading.');
    if (!cached.provider.configured()) throw new Error('This provider is no longer configured');
    const file = await this.playback.movieFile(movieId);
    return this.library.save(movieId, file.path, cached.result, () => cached.provider.download(cached.result));
  }
  private prune() {
    for (const [id, result] of this.results) if (result.expires <= Date.now()) this.results.delete(id);
    while (this.results.size > subtitleLimits.maxSearchResults - subtitleLimits.maxResultsPerProvider * this.providers.length) {
      this.results.delete(this.results.keys().next().value!);
    }
  }
}
