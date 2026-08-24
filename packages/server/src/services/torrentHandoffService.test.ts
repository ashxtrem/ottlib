import { describe, expect, it, vi } from 'vitest';
import { TorrentHandoffService } from './torrentHandoffService.js';

describe('TorrentHandoffService', () => {
  it('forwards allowed URLs with the configured category and save path', async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    const service = new TorrentHandoffService({ add } as never, { isConfigured: () => true } as never, { get: () => ({ qbittorrentCategory: 'ottlib', qbittorrentSavePath: 'E:/Downloads' }) } as never);
    await service.send('magnet:?xt=urn:btih:abc');
    expect(add).toHaveBeenCalledWith('magnet:?xt=urn:btih:abc', 'ottlib', 'E:/Downloads');
  });

  it('rejects non-torrent URL schemes before handoff', async () => {
    const add = vi.fn(); const service = new TorrentHandoffService({ add } as never, { isConfigured: () => true } as never, { get: vi.fn() } as never);
    await expect(service.send('file:///E:/movie.torrent')).rejects.toThrow('magnet link or an http(s)');
    expect(add).not.toHaveBeenCalled();
  });

  it('uses the OttLib category when the optional setting is blank', async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    const service = new TorrentHandoffService({ add } as never, { isConfigured: () => true } as never, { get: () => ({ qbittorrentCategory: ' ', qbittorrentSavePath: '' }) } as never);
    await service.send('magnet:?xt=urn:btih:abc');
    expect(add).toHaveBeenCalledWith('magnet:?xt=urn:btih:abc', 'ottlib', '');
  });
});
