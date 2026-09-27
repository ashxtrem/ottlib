export const playbackProgressMigration = `
CREATE TABLE IF NOT EXISTS playback_progress (
  movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  position_ms INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (movie_id, device_id)
);
CREATE INDEX IF NOT EXISTS idx_playback_progress_device ON playback_progress (device_id, updated_at DESC);
`;
