import type { TorrentConnectionStatus } from '@ottlib/shared';
import { QbittorrentClient, QbittorrentError } from '../providers/torrent/qbittorrentClient.js';
import { QbittorrentSearch } from '../providers/torrent/qbittorrentSearch.js';

export class TorrentConnectionService {
  private cached: TorrentConnectionStatus | undefined;

  public constructor(private readonly client: QbittorrentClient, private readonly search: QbittorrentSearch) {}

  public status(): TorrentConnectionStatus {
    if (this.cached) return this.cached;
    return this.client.isConfigured()
      ? { configured: true, status: 'untested', message: 'Connection has not been tested yet.', plugins: [] }
      : { configured: false, status: 'not-configured', message: 'qBittorrent is not configured.', plugins: [] };
  }

  public async test(): Promise<TorrentConnectionStatus> {
    if (!this.client.isConfigured()) return this.cache({ configured: false, status: 'not-configured', message: 'Add qBittorrent’s WebUI URL, username, and password in Settings first.', plugins: [] });
    try {
      const plugins = await this.search.plugins();
      if (!plugins.length) return this.cache({ configured: true, status: 'plugins-missing', message: 'qBittorrent connected, but its search plugin list is empty. Python may not be installed on the qBittorrent host, or no plugins are installed. Check qBittorrent’s Search tab.', plugins: [] });
      const enabled = plugins.filter((plugin) => plugin.enabled);
      return this.cache({ configured: true, status: 'connected', message: `Connected to qBittorrent. ${enabled.length} enabled search engine${enabled.length === 1 ? '' : 's'} available.`, plugins });
    } catch (error) {
      if (error instanceof QbittorrentError) {
        const status = error.kind === 'ip-banned' ? 'ip-banned' : error.kind === 'login-rejected' ? 'login-rejected' : 'unreachable';
        return this.cache({ configured: true, status, message: error.message, plugins: [] });
      }
      return this.cache({ configured: true, status: 'unreachable', message: 'qBittorrent could not be reached. Check its WebUI URL and availability.', plugins: [] });
    }
  }

  private cache(value: TorrentConnectionStatus): TorrentConnectionStatus { this.cached = value; return value; }
}
