import { afterEach, expect, it, vi } from 'vitest';
import { subtitleRequest } from './subtitleHttp.js';

afterEach(() => vi.unstubAllGlobals());
it('rejects arbitrary addresses before fetching and rejects redirects to local addresses', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/private' } }));
  vi.stubGlobal('fetch', fetch);
  await expect(subtitleRequest('https://attacker.invalid/subtitle')).rejects.toThrow('unsupported');
  expect(fetch).not.toHaveBeenCalled();
  await expect(subtitleRequest('https://dl.subdl.com/file')).rejects.toThrow('unsupported');
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('drops API credentials on cross-origin redirects and reports quota failures', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://dl.subdl.com/file' } })).mockResolvedValueOnce(new Response('subtitle'));
  vi.stubGlobal('fetch', fetch);
  await subtitleRequest('https://api.subdl.com/file', { headers: { 'X-API-Key': 'secret' } });
  expect(fetch.mock.calls[1][1].headers).toBeUndefined();
  fetch.mockResolvedValueOnce(new Response(null, { status: 429 }));
  await expect(subtitleRequest('https://api.subdl.com/file')).rejects.toThrow('quota');
});
