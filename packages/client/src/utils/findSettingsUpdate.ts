import type { FindProvider, UpdateSettings } from '@ottlib/shared';
import { torrentPreferencesUpdate } from './torrentPreferences';

/** The Find part of a settings save. qBittorrent's fields are only on the page (and only sent) while Find uses qBittorrent; saved values stay otherwise. */
export function findSettingsUpdate(values: FormData, torrentSearchEnabled: boolean, findProvider: FindProvider): UpdateSettings {
  const update: UpdateSettings = { torrentSearchEnabled, findProvider };
  if (!torrentSearchEnabled || findProvider !== 'qbittorrent') return update;
  Object.assign(update, {
    qbittorrentUrl: String(values.get('qbittorrentUrl') ?? '').trim(),
    qbittorrentUsername: String(values.get('qbittorrentUsername') ?? '').trim(),
    qbittorrentCategory: String(values.get('qbittorrentCategory') ?? '').trim(),
    qbittorrentSavePath: String(values.get('qbittorrentSavePath') ?? '').trim(),
    ...torrentPreferencesUpdate(values)
  });
  const qbittorrentPassword = values.get('qbittorrentPassword'); if (typeof qbittorrentPassword === 'string') update.qbittorrentPassword = qbittorrentPassword;
  return update;
}
