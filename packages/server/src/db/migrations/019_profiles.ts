import type Database from 'better-sqlite3';
import { profileColors } from '@ottlib/shared';

const profilesSchema = `
CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  color TEXT NOT NULL,
  pin_hash TEXT NULL,
  is_owner INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS profile_sessions (
  token_hash TEXT PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  device_id TEXT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_profile_sessions_profile ON profile_sessions (profile_id);
CREATE TABLE IF NOT EXISTS movie_hides (
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  hide_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (profile_id, hide_key)
);
CREATE TABLE IF NOT EXISTS playback_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  device_id TEXT NULL,
  method TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT NULL,
  start_position_ms INTEGER NOT NULL DEFAULT 0,
  end_position_ms INTEGER NULL,
  completed INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_playback_history_profile_movie ON playback_history (profile_id, movie_id, started_at);
`;

/** Profile tables, plus the owner profile "Home" when the install has no profiles yet. */
export function ensureProfiles(db: Database.Database): void {
  db.exec(profilesSchema);
  const existing = db.prepare('SELECT COUNT(*) AS count FROM profiles').get() as { count: number };
  if (existing.count === 0) {
    db.prepare("INSERT INTO profiles (name, color, pin_hash, is_owner, created_at) VALUES ('Home', ?, NULL, 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))").run(profileColors[0]);
  }
}
