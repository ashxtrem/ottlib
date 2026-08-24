import { QbittorrentClient } from '../providers/torrent/qbittorrentClient.js';
import { QbittorrentTorrents } from '../providers/torrent/qbittorrentTorrents.js';
import { SettingRepository } from '../repositories/settingRepository.js';

export class TorrentHandoffService {
  public constructor(private readonly torrents: QbittorrentTorrents, private readonly client: QbittorrentClient, private readonly settings: SettingRepository) {}

  public async send(url: string): Promise<void> {
    if (!this.client.isConfigured()) throw new Error('qBittorrent is not configured. Add its URL, username, and password in Settings.');
    this.validateUrl(url);
    const settings = this.settings.get();
    await this.torrents.add(url, settings.qbittorrentCategory.trim() || 'ottlib', settings.qbittorrentSavePath);
  }

  private validateUrl(value: string): void {
    let protocol: string;
    try { protocol = new URL(value).protocol; } catch { throw new Error('Torrent URL must be a magnet link or an http(s) .torrent URL.'); }
    if (!['magnet:', 'http:', 'https:'].includes(protocol)) throw new Error('Torrent URL must be a magnet link or an http(s) .torrent URL.');
  }
}
