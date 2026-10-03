import type { Settings } from '@ottlib/shared';
import type { ProviderSubtitle, SubtitleProvider, SubtitleQuery } from './SubtitleProvider.js';
import { subtitleJson, subtitleRequest } from './subtitleHttp.js';

interface SearchItem {
  attributes: {
    language: string; release?: string; hearing_impaired?: boolean; foreign_parts_only?: boolean;
    moviehash_match?: boolean; download_count?: number;
    files: Array<{ file_id: number; file_name: string }>;
  };
}
const base = 'https://api.opensubtitles.com/api/v1';

export class OpensubtitlesProvider implements SubtitleProvider {
  readonly name = 'OpenSubtitles';
  private login?: { credentials: string; token: string; expires: number; base: string };
  constructor(private readonly settings: () => Settings) {}
  configured(): boolean { return Boolean(this.settings().opensubtitlesApiKey.trim()); }
  private headers(): Record<string, string> {
    return { 'Api-Key': this.settings().opensubtitlesApiKey.trim(), 'User-Agent': 'Ottlib v0.1.0', 'Content-Type': 'application/json' };
  }
  async search(query: SubtitleQuery): Promise<ProviderSubtitle[]> {
    const params = new URLSearchParams({ languages: query.languages.sort().join(','), type: query.type === 'tv' ? 'episode' : 'movie' });
    if (query.mode === 'auto' && query.imdbId) {
      params.set(query.type === 'tv' ? 'parent_imdb_id' : 'imdb_id', query.imdbId.replace(/^tt/, ''));
    } else params.set('query', query.mode === 'filename' ? query.filename : query.title);
    if (query.mode === 'auto' && query.hash) { params.set('moviehash', query.hash); if (!query.imdbId) params.set('query', query.filename); }
    if (query.year && query.type === 'movie') params.set('year', String(query.year));
    if (query.season) params.set('season_number', String(query.season));
    if (query.episode) params.set('episode_number', String(query.episode));
    const response = await subtitleJson<{ data: SearchItem[] }>(`${base}/subtitles?${params}`, { headers: this.headers() });
    if (!Array.isArray(response.data)) throw new Error('Provider returned invalid search results');
    return response.data.flatMap(({ attributes: a }) => a.files.map(file => ({
      provider: this.name, remoteId: String(file.file_id), language: a.language,
      releaseName: a.release || file.file_name, format: file.file_name.split('.').pop()?.toLowerCase() || 'srt',
      hearingImpaired: Boolean(a.hearing_impaired), forced: Boolean(a.foreign_parts_only),
      hashMatch: Boolean(a.moviehash_match), downloads: Math.max(0, a.download_count ?? 0), score: a.moviehash_match ? 1 : 0,
    })));
  }
  private async token(): Promise<string | undefined> {
    const { opensubtitlesUsername: username, opensubtitlesPassword: password } = this.settings();
    if (!username || !password) return undefined;
    const credentials = `${username}\0${password}\0${this.settings().opensubtitlesApiKey}`;
    if (this.login?.credentials === credentials && this.login.expires > Date.now()) return this.login.token;
    const result = await subtitleJson<{ token: string; base_url?: string }>(`${base}/login`, { method: 'POST', headers: this.headers(), body: JSON.stringify({ username, password }) });
    if (!result.token) throw new Error('OpenSubtitles sign-in failed');
    const host = result.base_url ? new URL(result.base_url.includes('://') ? result.base_url : `https://${result.base_url}`) : new URL(base);
    if (host.protocol !== 'https:' || !['api.opensubtitles.com', 'vip-api.opensubtitles.com'].includes(host.hostname) || host.username || host.password || host.port) throw new Error('OpenSubtitles returned an unsupported account server');
    this.login = { credentials, token: result.token, expires: Date.now() + 20 * 60_000, base: `${host.origin}/api/v1` };
    return result.token;
  }
  async download(result: ProviderSubtitle): Promise<{ bytes: Buffer; filename: string }> {
    const token = await this.token();
    const data = await subtitleJson<{ link: string; file_name: string }>(`${token ? this.login!.base : base}/download`, {
      method: 'POST', headers: { ...this.headers(), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ file_id: Number(result.remoteId), sub_format: 'srt' }),
    });
    if (!data.link) throw new Error('OpenSubtitles did not return a download link');
    const file = await subtitleRequest(data.link);
    return { ...file, filename: data.file_name || file.filename };
  }
}
