/** Wait between polls when the server sends 202 without a usable Retry-After. */
const DEFAULT_RETRY_MS = 2_000;
/** Give up after this long (a slow disk can take minutes to extract a track). */
const MAX_WAIT_MS = 10 * 60_000;

/** Retry-After in seconds (the only form the server sends), clamped to 1–30 s. */
export function retryAfterMs(header: string | null): number {
  const seconds = Number(header);
  if (header === null || header.trim() === '' || !Number.isFinite(seconds)) return DEFAULT_RETRY_MS;
  return Math.min(30, Math.max(1, seconds)) * 1000;
}

type FetchLike = (url: string, init: RequestInit) => Promise<Pick<Response, 'status' | 'ok' | 'headers'>>;

export interface WaitOptions {
  signal: AbortSignal;
  /** Called on each 202 (the server is still extracting the track). */
  onPreparing: () => void;
  fetchImpl?: FetchLike;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
}

function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
  });
}

/**
 * Resolves true once the subtitle URL answers 200, polling with HEAD (GET when HEAD isn't allowed) while it answers
 * 202 and honouring Retry-After. Resolves false on any other answer or after ten minutes; rejects when aborted.
 */
export async function waitForSubtitle(url: string, { signal, onPreparing, fetchImpl = fetch, sleep = abortableSleep }: WaitOptions): Promise<boolean> {
  let method = 'HEAD';
  let waited = 0;
  for (;;) {
    const response = await fetchImpl(url, { method, signal, cache: 'no-store', credentials: 'same-origin' });
    if (response.status === 405 && method === 'HEAD') { method = 'GET'; continue; }
    if (response.status !== 202) return response.ok;
    onPreparing();
    const delay = retryAfterMs(response.headers.get('retry-after'));
    if (waited + delay > MAX_WAIT_MS) return false;
    waited += delay;
    await sleep(delay, signal);
  }
}
