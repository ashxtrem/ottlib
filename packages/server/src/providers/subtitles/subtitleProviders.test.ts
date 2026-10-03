import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '../../config/defaults.js';
import { OpensubtitlesProvider } from './opensubtitlesProvider.js';
import { SubdlProvider } from './subdlProvider.js';
import type { SubtitleQuery } from './SubtitleProvider.js';

const query: SubtitleQuery = { mode: 'auto', title: 'Show', filename: 'Show.S02E03.WEB-DL.mkv', imdbId: 'tt12345', year: 2020, season: 2, episode: 3, type: 'tv', languages: ['en'], hash: 'abcdef0123456789' };
const json = (value: unknown) => new Response(JSON.stringify(value));
afterEach(() => vi.unstubAllGlobals());
describe('OpenSubtitles adapter', () => {
  it('uses parent IDs and exact episodes for automatic search, and respects manual searches', async () => {
    const fetch = vi.fn().mockImplementation(() => json({ data: [{ attributes: { language: 'en', release: 'Show.S02E03.WEB-DL', moviehash_match: true, hearing_impaired: true, files: [{ file_id: 12, file_name: 'show.srt' }] } }] }));
    vi.stubGlobal('fetch', fetch);
    const provider = new OpensubtitlesProvider(() => ({ ...defaultSettings, opensubtitlesApiKey: 'key' }));
    const results = await provider.search(query);
    const url = new URL(String(fetch.mock.calls[0][0]));
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ parent_imdb_id: '12345', season_number: '2', episode_number: '3', moviehash: query.hash, type: 'episode' });
    expect(results[0]).toMatchObject({ remoteId: '12', hashMatch: true, hearingImpaired: true, language: 'en', score: 1 });
    await provider.search({ ...query, mode: 'manual', title: 'Another show', hash: undefined });
    const manual = new URL(String(fetch.mock.calls[1][0]));
    expect(manual.searchParams.get('query')).toBe('Another show');
    expect(manual.searchParams.has('parent_imdb_id')).toBe(false);
    expect(manual.searchParams.has('moviehash')).toBe(false);
    await provider.search({ ...query, mode: 'filename' });
    expect(new URL(String(fetch.mock.calls[2][0])).searchParams.get('query')).toBe(query.filename);
  });
  it('uses the account server for downloads and caches sign-in without leaking credentials to file hosts', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json({ token: 'jwt', base_url: 'vip-api.opensubtitles.com' }))
      .mockResolvedValueOnce(json({ link: 'https://www.opensubtitles.com/file/test', file_name: 'show.srt' }))
      .mockResolvedValueOnce(new Response('subtitle'));
    vi.stubGlobal('fetch', fetch);
    const provider = new OpensubtitlesProvider(() => ({ ...defaultSettings, opensubtitlesApiKey: 'key', opensubtitlesUsername: 'viewer', opensubtitlesPassword: 'password' }));
    await provider.download({ provider: 'OpenSubtitles', remoteId: '12', language: 'en', releaseName: 'show', format: 'srt', hearingImpaired: false, forced: false, hashMatch: false, score: 0, downloads: 0 });
    expect(String(fetch.mock.calls[1][0])).toBe('https://vip-api.opensubtitles.com/api/v1/download');
    expect(fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer jwt');
    expect(fetch.mock.calls[2][1].headers).toBeUndefined();
  });
});
describe('SubDL adapter', () => {
  it('requests per-file results and filters a season pack to the requested episode', async () => {
    const fetch = vi.fn().mockResolvedValue(json({ status: true, subtitles: [{ full_season: true, language: 'English', unpack_files: [
      { file_n_id: 'episode-2', name: 'show.S02E02.srt', season: 2, episode: 2, url: '/subtitle/pack/episode-2' },
      { file_n_id: 'episode-3', name: 'show.S02E03.srt', season: 2, episode: 3, url: '/subtitle/pack/episode-3' },
    ] }] }));
    vi.stubGlobal('fetch', fetch);
    const provider = new SubdlProvider(() => ({ ...defaultSettings, subdlApiKey: 'key' }));
    const results = await provider.search(query);
    expect(new URL(String(fetch.mock.calls[0][0])).searchParams.get('unpack')).toBe('1');
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ remoteId: 'episode-3', downloadUrl: 'https://dl.subdl.com/subtitle/pack/episode-3' });
    fetch.mockResolvedValueOnce(new Response('subtitle'));
    await provider.download(results[0]);
    expect(fetch.mock.calls[1][1].headers['X-API-Key']).toBe('key');
    await expect(provider.download({ ...results[0], downloadUrl: 'https://www.opensubtitles.com/file' })).rejects.toThrow('unsupported');
  });
});
