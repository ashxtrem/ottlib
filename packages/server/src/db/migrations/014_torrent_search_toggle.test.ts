import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { ensureTorrentSearchToggle } from './014_torrent_search_toggle.js';

function settingsDb(rows: Record<string, unknown>) {
  const db = new Database(':memory:');
  db.exec('CREATE TABLE settings (key TEXT PRIMARY KEY, value_json TEXT NOT NULL)');
  for (const [key, value] of Object.entries(rows)) db.prepare('INSERT INTO settings (key, value_json) VALUES (?, ?)').run(key, JSON.stringify(value));
  return db;
}
const toggle = (db: Database.Database) => (db.prepare("SELECT value_json FROM settings WHERE key = 'torrentSearchEnabled'").get() as { value_json: string } | undefined)?.value_json;

describe('ensureTorrentSearchToggle', () => {
  it('keeps torrent search on for installs that already configured qBittorrent', () => {
    const db = settingsDb({ qbittorrentUrl: 'http://127.0.0.1:8080' }); ensureTorrentSearchToggle(db);
    expect(toggle(db)).toBe('true');
  });

  it('leaves new installs and an explicit choice alone', () => {
    const fresh = settingsDb({ qbittorrentUrl: '' }); ensureTorrentSearchToggle(fresh);
    expect(toggle(fresh)).toBeUndefined();
    const chosen = settingsDb({ qbittorrentUrl: 'http://127.0.0.1:8080', torrentSearchEnabled: false }); ensureTorrentSearchToggle(chosen);
    expect(toggle(chosen)).toBe('false');
  });
});
