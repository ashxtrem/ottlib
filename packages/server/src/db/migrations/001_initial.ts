export const initialMigration = `
CREATE TABLE IF NOT EXISTS folders (
  id INTEGER PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS movies (
  id INTEGER PRIMARY KEY,
  folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE RESTRICT,
  canonical_path TEXT NOT NULL UNIQUE,
  raw_filename TEXT NOT NULL,
  parsed_title TEXT NOT NULL,
  parsed_year INTEGER,
  title_override TEXT,
  size INTEGER NOT NULL,
  mtime_ms INTEGER NOT NULL,
  last_seen_at TEXT NOT NULL,
  added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata_status TEXT NOT NULL DEFAULT 'pending',
  metadata_source TEXT,
  provider_id TEXT,
  imdb_id TEXT,
  matched_at TEXT,
  metadata_error TEXT,
  overview TEXT,
  poster_file TEXT,
  backdrop_file TEXT,
  genres_json TEXT NOT NULL DEFAULT '[]',
  cast_json TEXT NOT NULL DEFAULT '[]',
  rating REAL,
  runtime INTEGER,
  missing INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS movie_watch_state (
  movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  watched INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (movie_id, device_id)
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS scan_runs (
  id INTEGER PRIMARY KEY,
  folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'scan',
  status TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT,
  files_found INTEGER NOT NULL DEFAULT 0,
  files_processed INTEGER NOT NULL DEFAULT 0,
  titles_added INTEGER NOT NULL DEFAULT 0,
  error_summary TEXT
);
CREATE INDEX IF NOT EXISTS movies_library_idx ON movies (missing, parsed_title);
CREATE INDEX IF NOT EXISTS movies_folder_seen_idx ON movies (folder_id, last_seen_at);
CREATE INDEX IF NOT EXISTS scan_runs_status_idx ON scan_runs (status);
`;
