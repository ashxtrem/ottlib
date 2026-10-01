import type Database from 'better-sqlite3';

/**
 * Torrent search became opt-in. Installs that already set up qBittorrent keep it switched on; everyone else
 * gets the off-by-default value from the settings defaults.
 */
export function ensureTorrentSearchToggle(db: Database.Database): void {
  const row = (key: string) => db.prepare('SELECT value_json FROM settings WHERE key = ?').get(key) as { value_json: string } | undefined;
  if (row('torrentSearchEnabled')) return;
  const url = row('qbittorrentUrl');
  if (url && String(JSON.parse(url.value_json)).trim()) db.prepare('INSERT INTO settings (key, value_json) VALUES (?, ?)').run('torrentSearchEnabled', 'true');
}
