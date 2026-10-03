import { subtitleDownloadHosts, subtitleLimits } from '../../config/subtitles.js';

export function safeSubtitleUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !subtitleDownloadHosts.includes(url.hostname)) {
    throw new Error('The provider returned an unsupported download address');
  }
  return url;
}

export async function subtitleRequest(url: string, init: RequestInit = {}): Promise<{ bytes: Buffer; filename: string }> {
  let target = safeSubtitleUrl(url);
  const signal = AbortSignal.timeout(subtitleLimits.timeoutMs);
  let options = init;
  for (let redirect = 0; redirect <= subtitleLimits.maxRedirects; redirect++) {
    const response = await fetch(target, { ...options, signal, redirect: 'manual' });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location || redirect === subtitleLimits.maxRedirects) throw new Error('Subtitle download redirect failed');
      const next = safeSubtitleUrl(new URL(location, target).href);
      if (next.origin !== target.origin) options = {}; // Credentials only go to the original API host.
      target = next;
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      if ([401, 403].includes(response.status)) throw new Error('Check the provider API key/account in web Settings');
      if ([402, 406, 429].includes(response.status)) throw new Error('Provider quota reached; try another provider or try again later');
      throw new Error(`Provider request failed (${response.status})`);
    }
    if (Number(response.headers.get('content-length')) > subtitleLimits.maxArchiveBytes) {
      await response.body?.cancel(); throw new Error('Subtitle response is too large');
    }
    const chunks: Buffer[] = []; let size = 0;
    if (response.body) {
      const reader = response.body.getReader();
      try {
        while (true) {
          const chunk = await reader.read(); if (chunk.done) break;
          size += chunk.value.length;
          if (size > subtitleLimits.maxArchiveBytes) { await reader.cancel(); throw new Error('Subtitle response is too large'); }
          chunks.push(Buffer.from(chunk.value));
        }
      } finally { reader.releaseLock(); }
    }
    const disposition = response.headers.get('content-disposition') ?? '';
    const filename = disposition.match(/filename\*?=(?:UTF-8''|"?)([^";]+)/i)?.[1] ?? target.pathname.split('/').pop() ?? '';
    return { bytes: Buffer.concat(chunks), filename };
  }
  throw new Error('Subtitle request failed');
}

export async function subtitleJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const result = await subtitleRequest(url, init);
  try { return JSON.parse(result.bytes.toString('utf8')) as T; }
  catch { throw new Error('Provider returned an invalid response'); }
}
