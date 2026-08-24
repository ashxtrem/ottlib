import { QbittorrentClient } from './qbittorrentClient.js';

export interface QbittorrentSearchStatus {
  id: string;
  status: string;
  total: number;
}

export interface QbittorrentSearchResults {
  total: number;
  results: Array<Record<string, unknown>>;
}

export interface QbittorrentSearchPlugin {
  name: string;
  enabled: boolean;
}

export class QbittorrentSearch {
  public constructor(private readonly client: QbittorrentClient) {}

  public async start(pattern: string): Promise<string> {
    const payload = await this.client.postForm<unknown>('search/start', { pattern, plugins: 'enabled', category: 'movies' });
    const id = typeof payload === 'object' && payload !== null && 'id' in payload ? (payload as { id: unknown }).id : undefined;
    if (typeof id !== 'number' && typeof id !== 'string') throw new Error('qBittorrent returned an invalid search id.');
    return String(id);
  }

  public async status(id: string): Promise<QbittorrentSearchStatus | undefined> {
    const payload = await this.client.get<unknown>(`search/status?id=${encodeURIComponent(id)}`);
    const item = Array.isArray(payload) ? payload[0] : payload;
    if (!item || typeof item !== 'object') return undefined;
    const raw = item as Record<string, unknown>;
    return { id: String(raw.id ?? id), status: String(raw.status ?? 'Stopped'), total: number(raw.total) };
  }

  public async results(id: string, limit: number, offset: number): Promise<QbittorrentSearchResults> {
    const payload = await this.client.get<unknown>(`search/results?id=${encodeURIComponent(id)}&limit=${limit}&offset=${offset}`);
    const raw = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
    return { total: number(raw.total), results: Array.isArray(raw.results) ? raw.results.filter(isRecord) : [] };
  }

  public async stop(id: string): Promise<void> { await this.client.postForm<unknown>('search/stop', { id }); }
  public async delete(id: string): Promise<void> { await this.client.postForm<unknown>('search/delete', { id }); }

  public async plugins(): Promise<QbittorrentSearchPlugin[]> {
    const payload = await this.client.get<unknown>('search/plugins');
    if (!Array.isArray(payload)) return [];
    return payload.filter(isRecord).map((plugin) => ({
      name: string(plugin.fullName) || string(plugin.name) || 'Unnamed plugin',
      enabled: plugin.enabled !== false
    }));
  }
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null; }
function number(value: unknown): number { const result = Number(value); return Number.isFinite(result) && result >= 0 ? result : 0; }
function string(value: unknown): string { return typeof value === 'string' ? value : ''; }
