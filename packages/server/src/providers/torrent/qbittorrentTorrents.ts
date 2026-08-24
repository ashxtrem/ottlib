import { QbittorrentClient } from './qbittorrentClient.js';

export interface QbittorrentTorrentInfo {
  hash: string;
  name: string;
  state: string;
  progress: number;
  downloaded: number;
  size: number;
  dlspeed: number;
  eta: number;
  num_seeds: number;
  num_leechs: number;
  save_path: string;
  error: string;
}

export class QbittorrentTorrents {
  public constructor(private readonly client: QbittorrentClient) {}

  public async add(url: string, category: string, savePath: string): Promise<void> {
    await this.client.postForm<unknown>('torrents/add', {
      urls: url,
      category: category.trim() || undefined,
      savepath: savePath.trim() || undefined
    });
  }

  public async active(category: string): Promise<QbittorrentTorrentInfo[]> {
    const params = new URLSearchParams({ filter: 'active' });
    if (category.trim()) params.set('category', category.trim());
    return this.client.get<QbittorrentTorrentInfo[]>(`torrents/info?${params}`);
  }
}
