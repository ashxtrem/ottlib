export const downloadedSubtitlesMigration = `
CREATE TABLE IF NOT EXISTS downloaded_subtitles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, remote_id TEXT NOT NULL,
  language TEXT NOT NULL, release_name TEXT NOT NULL,
  format TEXT NOT NULL, path TEXT NOT NULL, sidecar_path TEXT,
  hearing_impaired INTEGER NOT NULL, forced INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(movie_id, provider, remote_id)
);`;
