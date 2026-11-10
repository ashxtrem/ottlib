export const LATEST_RELEASE_URL = 'https://api.github.com/repos/ashxtrem/ottlib/releases/latest';
export const LATEST_RELEASE_CACHE_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5_000;

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

/** The newest OttLib release tag on GitHub, asked at most once per 24 h; a failed request is not cached. */
export class LatestRelease {
  private cached: { tag: string; at: number } | undefined;

  public constructor(private readonly fetchFn: FetchFn = fetch, private readonly now: () => number = Date.now) {}

  public async tag(): Promise<string> {
    if (this.cached && this.now() - this.cached.at < LATEST_RELEASE_CACHE_MS) return this.cached.tag;
    const response = await this.fetchFn(LATEST_RELEASE_URL, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'ottlib' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
    if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
    const tag = ((await response.json()) as { tag_name?: unknown }).tag_name;
    if (typeof tag !== 'string' || !tag.trim()) throw new Error('GitHub sent no release tag');
    this.cached = { tag: tag.trim(), at: this.now() };
    return this.cached.tag;
  }
}

/** Compares dotted numeric versions (`v` prefix and any `-suffix` ignored): negative when `a` is older than `b`. */
export function compareVersions(a: string, b: string): number {
  const parts = (value: string) => value.replace(/^v/i, '').split('-')[0].split('.').map((part) => Number.parseInt(part, 10) || 0);
  const left = parts(a); const right = parts(b);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff) return diff;
  }
  return 0;
}
