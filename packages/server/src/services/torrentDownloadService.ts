import type { ActiveTorrentDownloads, TorrentDownload } from '@ottlib/shared';
import { QbittorrentError } from '../providers/torrent/qbittorrentClient.js';
import { QbittorrentTorrents, type QbittorrentTorrentInfo } from '../providers/torrent/qbittorrentTorrents.js';
import { SettingRepository } from '../repositories/settingRepository.js';

/** Converts qBittorrent's live, untrusted WebUI response into the client contract. */
export class TorrentDownloadService {
  public constructor(private readonly torrents: QbittorrentTorrents, private readonly settings: SettingRepository) {}

  public async active(): Promise<ActiveTorrentDownloads> {
    try {
      const category = this.settings.get().qbittorrentCategory.trim() || 'ottlib';
      const torrents = await this.torrents.active(category);
      return { status: 'ok', torrents: torrents.map(toTorrentDownload) };
    } catch (error) {
      if (isQbittorrentError(error)) return { status: statusFor(error), message: error.message, torrents: [] };
      return { status: 'error', message: 'Could not load active qBittorrent downloads.', torrents: [] };
    }
  }
}

function toTorrentDownload(torrent: QbittorrentTorrentInfo): TorrentDownload {
  return {
    hash: stringValue(torrent.hash),
    name: stringValue(torrent.name) || 'Unnamed torrent',
    state: stringValue(torrent.state) || 'unknown',
    progress: Math.min(1, Math.max(0, numberValue(torrent.progress))),
    downloadedBytes: numberValue(torrent.downloaded),
    totalBytes: numberValue(torrent.size),
    downloadSpeed: numberValue(torrent.dlspeed),
    etaSeconds: optionalCount(torrent.eta),
    seeds: optionalCount(torrent.num_seeds),
    peers: optionalCount(torrent.num_leechs),
    savePath: stringValue(torrent.save_path) || null,
    error: stringValue(torrent.error) || null
  };
}

function statusFor(error: QbittorrentError): ActiveTorrentDownloads['status'] {
  if (error.kind === 'not-configured') return 'not-configured';
  if (error.kind === 'login-rejected') return 'login-rejected';
  if (error.kind === 'ip-banned') return 'ip-banned';
  if (error.kind === 'unreachable') return 'unreachable';
  return 'error';
}

function isQbittorrentError(error: unknown): error is QbittorrentError {
  return error instanceof QbittorrentError || (typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'QbittorrentError' && typeof (error as { kind?: unknown }).kind === 'string');
}

function stringValue(value: unknown): string { return typeof value === 'string' ? value : ''; }
function numberValue(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0; }
function optionalCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
}
