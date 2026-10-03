import type { Settings } from '@ottlib/shared';
import type { ProviderSubtitle, SubtitleProvider, SubtitleQuery } from './SubtitleProvider.js';
import { subtitleJson, subtitleRequest } from './subtitleHttp.js';

interface SubdlFile {
  file_n_id?: string; name?: string; release_name?: string; language?: string; lang?: string;
  url?: string; format?: string; hi?: boolean; season?: number; episode?: number;
}
interface SubdlItem extends SubdlFile {
  n_id?: string; full_season?: boolean; match_score?: number; unpack_files?: SubdlFile[];
}

export class SubdlProvider implements SubtitleProvider {
  readonly name = 'SubDL';
  constructor(private readonly settings: () => Settings) {}
  configured(): boolean { return Boolean(this.settings().subdlApiKey.trim()); }
  private headers(): Record<string, string> { return { 'X-API-Key': this.settings().subdlApiKey.trim() }; }
  async search(query: SubtitleQuery): Promise<ProviderSubtitle[]> {
    const params = new URLSearchParams({ languages: query.languages.join(','), type: query.type, unpack: '1' });
    if (query.mode === 'auto' && query.imdbId) params.set('imdb_id', query.imdbId);
    else params.set(query.mode === 'filename' ? 'file_name' : 'film_name', query.mode === 'filename' ? query.filename : query.title);
    if (query.year) params.set('year', String(query.year));
    if (query.season) params.set('season', String(query.season));
    if (query.episode) params.set('episode', String(query.episode));
    const response = await subtitleJson<{ status?: boolean; subtitles: SubdlItem[] }>(`https://api.subdl.com/api/v2/subtitles/search?${params}`, { headers: this.headers() });
    if (response.status === false || !Array.isArray(response.subtitles)) throw new Error('SubDL search failed');
    return response.subtitles.flatMap(item => {
      const files = item.unpack_files?.length ? item.unpack_files : item.full_season ? [] : [item];
      return files.filter(file => (!query.season || !file.season || file.season === query.season) && (!query.episode || !file.episode || file.episode === query.episode))
        .filter(file => Boolean(file.url)).map(file => ({
          provider: this.name, remoteId: file.file_n_id || file.url!,
          language: file.language || file.lang || item.language || item.lang || '',
          releaseName: file.release_name || item.release_name || file.name || item.name || 'Subtitles',
          format: file.format?.toLowerCase() || file.name?.split('.').pop()?.toLowerCase() || 'srt',
          hearingImpaired: Boolean(file.hi ?? item.hi), forced: false,
          hashMatch: false, downloads: 0, score: Math.min(1, Math.max(0, item.match_score ?? 0)),
          downloadUrl: new URL(file.url!, 'https://dl.subdl.com').href,
        }));
    });
  }
  async download(result: ProviderSubtitle): Promise<{ bytes: Buffer; filename: string }> {
    if (!result.downloadUrl) throw new Error('SubDL download is unavailable');
    const url = new URL(result.downloadUrl);
    if (!['dl.subdl.com', 'api.subdl.com'].includes(url.hostname)) throw new Error('SubDL returned an unsupported download address');
    // Raw per-file URLs avoid choosing an arbitrary episode from a season archive.
    return subtitleRequest(result.downloadUrl, { headers: this.headers() });
  }
}
