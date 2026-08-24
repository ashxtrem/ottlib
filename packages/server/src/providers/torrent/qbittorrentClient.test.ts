import { describe, expect, it, vi } from 'vitest';
import type { Settings } from '@ottlib/shared';
import { QbittorrentClient } from './qbittorrentClient.js';
import * as searchModule from './qbittorrentSearch.js';

function configuredSettings(): Settings {
  return { tmdbApiKey: '', omdbApiKey: '', qbittorrentUrl: 'http://qb.local:8080', qbittorrentUsername: 'alice', qbittorrentPassword: 'secret', qbittorrentCategory: 'ottlib', qbittorrentSavePath: '', extensions: [], ignoredPatterns: [], excludedFolders: [], scheduleEnabled: false, scheduleCron: '0 3 * * *' };
}

describe('QbittorrentClient', () => {
  it('logs in with form credentials and sends the SID and matching Referer on subsequent calls', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('Ok.', { headers: { 'set-cookie': 'SID=session-one; HttpOnly' } })).mockResolvedValueOnce(new Response('[]'));
    const client = new QbittorrentClient(configuredSettings, fetchMock as unknown as typeof fetch);
    await expect(client.get<unknown[]>('search/plugins')).resolves.toEqual([]);
    const login = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const plugins = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(new Headers(login.headers).get('referer')).toBe('http://qb.local:8080');
    expect(String(login.body)).toContain('username=alice');
    expect(String(login.body)).toContain('password=secret');
    expect(new Headers(plugins.headers).get('cookie')).toBe('SID=session-one');
  });

  it('re-authenticates and retries exactly once after a session 403', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('Ok.', { headers: { 'set-cookie': 'SID=old; HttpOnly' } })).mockResolvedValueOnce(new Response('', { status: 403 })).mockResolvedValueOnce(new Response('Ok.', { headers: { 'set-cookie': 'SID=new; HttpOnly' } })).mockResolvedValueOnce(new Response('[]'));
    const client = new QbittorrentClient(configuredSettings, fetchMock as unknown as typeof fetch);
    await client.get('search/plugins');
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(new Headers(fetchMock.mock.calls[3]?.[1]?.headers).get('cookie')).toBe('SID=new');
  });

  it('distinguishes an IP ban from bad credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 403 }));
    const client = new QbittorrentClient(configuredSettings, fetchMock as unknown as typeof fetch);
    await expect(client.get('search/plugins')).rejects.toMatchObject({ kind: 'ip-banned' });
  });

  it('maps qBittorrent’s 200 Fails response to a credential error', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('Fails.'));
    const client = new QbittorrentClient(configuredSettings, fetchMock as unknown as typeof fetch);
    await expect(client.get('search/plugins')).rejects.toThrow('rejected the WebUI username or password');
  });

  it('passes the active torrent filter and configured category through to qBittorrent', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('Ok.', { headers: { 'set-cookie': 'SID=session-one; HttpOnly' } })).mockResolvedValueOnce(new Response('[]'));
    const client = new QbittorrentClient(configuredSettings, fetchMock as unknown as typeof fetch);
    await client.get('torrents/info?filter=active&category=ottlib');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('http://qb.local:8080/api/v2/torrents/info?filter=active&category=ottlib');
  });
});

describe('qBittorrent plugin endpoint allowlist', () => {
  it('exports no plugin-mutating operation', () => {
    expect(Object.keys(searchModule)).not.toContain('installPlugin');
    expect(Object.keys(searchModule)).not.toContain('uninstallPlugin');
    expect(Object.keys(searchModule)).not.toContain('updatePlugins');
  });
});
