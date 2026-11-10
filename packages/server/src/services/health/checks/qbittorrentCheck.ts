import type { TorrentConnectionStatus } from '@ottlib/shared';
import type { HealthCheck } from '../HealthCheck.js';

/** qBittorrent's WebUI, tried the same way as Settings → Test connection (`TorrentConnectionService.test`). */
export function qbittorrentCheck(test: () => Promise<TorrentConnectionStatus>): HealthCheck {
  return {
    id: 'qbittorrent',
    label: 'qBittorrent',
    async run() {
      const result = await test();
      if (result.status === 'connected' || result.status === 'plugins-missing') return { state: 'ok', message: result.message };
      return { state: 'fail', message: result.message, fix: 'Check qBittorrent’s WebUI URL, username and password under Settings → Torrent search, and that qBittorrent is running.' };
    }
  };
}
