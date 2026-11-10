import { readAppVersion } from '../config/appVersion.js';
import { loadBootstrapConfig, resolveAppRoot } from '../config/configStore.js';
import { createDatabase } from '../db/db.js';
import { QbittorrentClient } from '../providers/torrent/qbittorrentClient.js';
import { QbittorrentSearch } from '../providers/torrent/qbittorrentSearch.js';
import { FfmpegLocator } from '../providers/transcode/ffmpegLocator.js';
import { BackupRepository } from '../repositories/backupRepository.js';
import { FolderRepository } from '../repositories/folderRepository.js';
import { MovieExtrasRepository } from '../repositories/movieExtrasRepository.js';
import { SettingRepository } from '../repositories/settingRepository.js';
import { BackupService } from '../services/backupService.js';
import { doctorReport } from '../services/health/doctorReport.js';
import { healthChecks } from '../services/health/healthChecks.js';
import { HealthService } from '../services/health/healthService.js';
import { LatestRelease } from '../services/health/latestRelease.js';
import { checkTmdbKey } from '../services/settingsService.js';
import { TorrentConnectionService } from '../services/torrentConnectionService.js';

/**
 * `npm run doctor --workspace @ottlib/server` (or `doctor.bat` / `doctor.sh` in a release folder): runs the same health
 * checks as `GET /api/health` against the configured library and prints one OK / WARN / FAIL line per check. Exits 1 when
 * any check fails. The config is found with `resolveAppRoot`, like the server and reset-pins.
 */
const config = await loadBootstrapConfig(resolveAppRoot());
const db = createDatabase(config.absoluteAppDataPath, { backupBeforeMigrate: true });
try {
  const settings = new SettingRepository(db); const folders = new FolderRepository(db);
  const extras = new MovieExtrasRepository(db);
  const ffmpeg = new FfmpegLocator(); const latestRelease = new LatestRelease(); const version = readAppVersion();
  const qbittorrent = new QbittorrentClient(() => settings.get()); const torrentConnection = new TorrentConnectionService(qbittorrent, new QbittorrentSearch(qbittorrent));
  const health = new HealthService(() => healthChecks({
    appDataPath: config.absoluteAppDataPath,
    folders: () => folders.list().map((folder) => folder.path),
    locateFfmpeg: () => ffmpeg.locate(),
    tmdbKey: () => settings.get().tmdbApiKey,
    testTmdbKey: checkTmdbKey,
    torrentSearchEnabled: () => settings.get().torrentSearchEnabled,
    testQbittorrent: () => torrentConnection.test(),
    backups: new BackupService(new BackupRepository(db), config.absoluteAppDataPath),
    idsMissingExtras: () => extras.idsMissingExtras(),
    update: { version: () => version, enabled: () => settings.get().updateCheckEnabled, latestTag: () => latestRelease.tag() }
  }));
  const { lines, exitCode } = doctorReport(await health.run(true));
  console.log(`Library: ${config.absoluteAppDataPath}`);
  for (const line of lines) console.log(line);
  process.exitCode = exitCode;
} finally {
  db.close();
}
