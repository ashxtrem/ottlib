import type { TorrentConnectionStatus } from '@ottlib/shared';
import type { FfmpegBinary } from '../../providers/transcode/ffmpegLocator.js';
import type { HealthCheck } from './HealthCheck.js';
import { backupsCheck, type BackupSource } from './checks/backupsCheck.js';
import { diskSpaceCheck } from './checks/diskSpaceCheck.js';
import { ffmpegCheck } from './checks/ffmpegCheck.js';
import { libraryFoldersCheck } from './checks/libraryFoldersCheck.js';
import { qbittorrentCheck } from './checks/qbittorrentCheck.js';
import { titleExtrasCheck } from './checks/titleExtras.js';
import { tmdbKeyCheck } from './checks/tmdbKeyCheck.js';
import { updateCheck, type UpdateCheckDeps } from './checks/updateCheck.js';

export interface HealthCheckDeps {
  appDataPath: string;
  folders: () => string[];
  locateFfmpeg: () => Promise<FfmpegBinary | null>;
  tmdbKey: () => string;
  testTmdbKey: (key: string) => Promise<unknown>;
  torrentSearchEnabled: () => boolean;
  testQbittorrent: () => Promise<TorrentConnectionStatus>;
  backups: BackupSource;
  idsMissingExtras: () => number[];
  update: UpdateCheckDeps;
}

/**
 * The registered checks, in display order, built fresh for each run so a check that doesn't apply right now
 * (qBittorrent while torrent search is off) is simply left out. A new check is one file under `checks/` plus one line here.
 */
export function healthChecks(deps: HealthCheckDeps): HealthCheck[] {
  return [
    libraryFoldersCheck(deps.folders),
    diskSpaceCheck(deps.appDataPath),
    ffmpegCheck(deps.locateFfmpeg),
    tmdbKeyCheck(deps.tmdbKey, deps.testTmdbKey),
    ...(deps.torrentSearchEnabled() ? [qbittorrentCheck(deps.testQbittorrent)] : []),
    backupsCheck(deps.backups),
    titleExtrasCheck(deps.idsMissingExtras),
    updateCheck(deps.update)
  ];
}
