import type { TorrentResult, TorrentSearchState } from '@ottlib/shared';
import { QbittorrentError } from '../providers/torrent/qbittorrentClient.js';
import { QbittorrentSearch } from '../providers/torrent/qbittorrentSearch.js';
import { MovieRepository } from '../repositories/movieRepository.js';
import { parseReleaseName } from './scanner/titleParser.js';
import { releaseQuality } from './torrent/releaseQuality.js';

const resultPageSize = 100;
const trackedSearchMaxAgeMs = 10 * 60_000;

interface TrackedSearch {
  id: string;
  createdAt: number;
  status: 'running' | 'stopped';
  total: number;
  results?: TorrentResult[];
}

export class TorrentSearchService {
  private readonly tracked = new Map<string, TrackedSearch>();

  public constructor(private readonly search: QbittorrentSearch, private readonly movies: MovieRepository, private readonly configured: () => boolean) {}

  public async start(query: string, year?: number): Promise<{ searchId?: string; status: 'running' | 'not-configured' | 'unreachable'; error?: string }> {
    if (!this.configured()) return { status: 'not-configured' };
    await this.reapExpired();
    const pattern = [query.trim(), year].filter(Boolean).join(' ');
    try {
      const id = await this.startRemote(pattern, true);
      this.tracked.set(id, { id, createdAt: Date.now(), status: 'running', total: 0 });
      return { searchId: id, status: 'running' };
    } catch (error) {
      if (error instanceof QbittorrentError && error.kind === 'unreachable') return { status: 'unreachable', error: error.message };
      throw error;
    }
  }

  public async status(id: string): Promise<TorrentSearchState> {
    const tracked = this.tracked.get(id);
    if (!tracked) throw new Error('Torrent search was not found or has expired.');
    if (tracked.results) return this.state(tracked);
    try {
      const remote = await this.search.status(id);
      if (!remote || remote.status.toLowerCase() === 'stopped') {
        tracked.status = 'stopped';
        tracked.results = await this.collectResults(id);
        tracked.total = tracked.results.length;
        await this.deleteRemote(id);
      } else {
        tracked.total = remote.total;
      }
      return this.state(tracked);
    } catch (error) {
      if (error instanceof QbittorrentError && error.kind === 'unreachable') return { searchId: id, status: 'unreachable', total: tracked.total, results: [], error: error.message };
      throw error;
    }
  }

  public async cancel(id: string): Promise<void> {
    const tracked = this.tracked.get(id);
    if (!tracked) return;
    this.tracked.delete(id);
    if (!tracked.results) {
      try { await this.search.stop(id); } catch { /* Delete is enough when the search already stopped. */ }
      await this.deleteRemote(id);
    }
  }

  private async startRemote(pattern: string, allowReap: boolean): Promise<string> {
    try { return await this.search.start(pattern); } catch (error) {
      if (allowReap && error instanceof QbittorrentError && error.status === 409) {
        await this.reapOldestRunning();
        return this.startRemote(pattern, false);
      }
      throw error;
    }
  }

  private async collectResults(id: string): Promise<TorrentResult[]> {
    const first = await this.search.results(id, resultPageSize, 0);
    const raw = [...first.results];
    for (let offset = raw.length; offset < first.total; offset += resultPageSize) {
      const page = await this.search.results(id, resultPageSize, offset);
      if (!page.results.length) break;
      raw.push(...page.results);
    }
    return this.processResults(raw);
  }

  private processResults(raw: Array<Record<string, unknown>>): TorrentResult[] {
    const deduped = new Map<string, TorrentResult>();
    for (const item of raw) {
      const fileUrl = stringField(item, ['fileUrl', 'file_url', 'url']).trim();
      if (!fileUrl) continue;
      const fileName = stringField(item, ['fileName', 'file_name', 'name']).trim() || fileUrl;
      const parsed = parseReleaseName(fileName);
      const match = this.movies.findForTorrentMatch(parsed.title, parsed.year);
      const result: TorrentResult = {
        fileName,
        fileSize: nonNegativeNumber(item.fileSize ?? item.file_size),
        fileUrl,
        nbSeeders: integerOrNull(item.nbSeeders ?? item.nb_seeders),
        nbLeechers: integerOrNull(item.nbLeechers ?? item.nb_leechers),
        siteUrl: optionalString(item.siteUrl ?? item.site_url),
        descrLink: optionalString(item.descrLink ?? item.descr_link),
        engines: [stringField(item, ['engineName', 'engine_name']).trim()].filter(Boolean),
        publishedAt: optionalString(item.pubDate ?? item.publishedAt ?? item.date),
        quality: releaseQuality(fileName),
        libraryStatus: match ? (match.missing ? 'missing' : 'owned') : 'new'
      };
      const key = normalizeTorrentUrl(fileUrl);
      const existing = deduped.get(key);
      if (!existing) { deduped.set(key, result); continue; }
      const engines = [...new Set([...existing.engines, ...result.engines])];
      if (seederRank(result.nbSeeders) > seederRank(existing.nbSeeders)) deduped.set(key, { ...result, engines });
      else deduped.set(key, { ...existing, engines });
    }
    return [...deduped.values()].sort((left, right) => seederRank(right.nbSeeders) - seederRank(left.nbSeeders) || left.fileName.localeCompare(right.fileName));
  }

  private state(tracked: TrackedSearch): TorrentSearchState {
    return { searchId: tracked.id, status: tracked.status, total: tracked.results?.length ?? tracked.total, results: tracked.results ?? [] };
  }

  private async reapExpired(): Promise<void> {
    const now = Date.now();
    await Promise.all([...this.tracked.values()]
      .filter((tracked) => now - tracked.createdAt > trackedSearchMaxAgeMs)
      .map((tracked) => this.cancel(tracked.id).catch(() => undefined)));
  }

  private async reapOldestRunning(): Promise<void> {
    const oldest = [...this.tracked.values()].filter((tracked) => !tracked.results).sort((left, right) => left.createdAt - right.createdAt)[0];
    if (oldest) await this.cancel(oldest.id);
  }

  private async deleteRemote(id: string): Promise<void> {
    try { await this.search.delete(id); } catch (error) {
      if (error instanceof QbittorrentError && error.kind === 'unreachable') throw error;
    }
  }
}

function stringField(value: Record<string, unknown>, keys: string[]): string {
  const match = keys.map((key) => value[key]).find((candidate) => typeof candidate === 'string');
  return typeof match === 'string' ? match : '';
}
function optionalString(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value : null; }
function nonNegativeNumber(value: unknown): number | null { const result = Number(value); return Number.isFinite(result) && result >= 0 ? result : null; }
function integerOrNull(value: unknown): number | null { const result = Number(value); return Number.isInteger(result) ? result : null; }
function seederRank(value: number | null): number { return value && value > 0 ? value : -1; }
function normalizeTorrentUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol === 'magnet:') return url.searchParams.get('xt')?.toLowerCase() || url.toString();
    return url.toString();
  } catch { return value.trim(); }
}
