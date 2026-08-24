import { describe, expect, it, vi } from 'vitest';
import { QbittorrentError } from '../providers/torrent/qbittorrentClient.js';
import { TorrentDownloadService } from './torrentDownloadService.js';

describe('TorrentDownloadService', () => {
  it('maps active qBittorrent torrents and queries the configured OttLib category', async () => {
    const active = vi.fn().mockResolvedValue([{ hash: 'abc', name: 'Movie.2026.1080p', state: 'downloading', progress: 0.42, downloaded: 420, size: 1_000, dlspeed: 55, eta: 120, num_seeds: 7, num_leechs: 2, save_path: 'E:/Downloads', error: '' }]);
    const service = new TorrentDownloadService({ active } as never, { get: () => ({ qbittorrentCategory: 'ottlib' }) } as never);
    await expect(service.active()).resolves.toEqual({ status: 'ok', torrents: [{ hash: 'abc', name: 'Movie.2026.1080p', state: 'downloading', progress: 0.42, downloadedBytes: 420, totalBytes: 1_000, downloadSpeed: 55, etaSeconds: 120, seeds: 7, peers: 2, savePath: 'E:/Downloads', error: null }] });
    expect(active).toHaveBeenCalledWith('ottlib');
  });

  it('returns a safe status when qBittorrent is unreachable', async () => {
    const service = new TorrentDownloadService({ active: vi.fn().mockRejectedValue(new QbittorrentError('qBittorrent could not be reached.', 'unreachable')) } as never, { get: () => ({ qbittorrentCategory: 'ottlib' }) } as never);
    await expect(service.active()).resolves.toEqual({ status: 'unreachable', message: 'qBittorrent could not be reached.', torrents: [] });
  });
});
