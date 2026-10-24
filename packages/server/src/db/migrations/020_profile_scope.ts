import type Database from 'better-sqlite3';

const progressTable = `
CREATE TABLE playback_progress_new (
  movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  device_id TEXT NULL,
  position_ms INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  shelf_id INTEGER REFERENCES shelves(id) ON DELETE SET NULL,
  PRIMARY KEY (movie_id, profile_id)
)`;

/** One row per title: the most recently updated device's progress wins. */
const copyProgress = `
INSERT INTO playback_progress_new (movie_id, profile_id, device_id, position_ms, duration_ms, updated_at, shelf_id)
SELECT movie_id, @owner, device_id, position_ms, duration_ms, updated_at, shelf_id FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY movie_id ORDER BY updated_at DESC, rowid DESC) AS rank FROM playback_progress
) WHERE rank = 1`;

const watchTable = `
CREATE TABLE movie_watch_state_new (
  movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  device_id TEXT NULL,
  watched INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  shelf_id INTEGER REFERENCES shelves(id) ON DELETE SET NULL,
  PRIMARY KEY (movie_id, profile_id)
)`;

/** One row per title: watched on any device counts (MAX(watched)); the newest such row supplies the rest. */
const copyWatchState = `
INSERT INTO movie_watch_state_new (movie_id, profile_id, device_id, watched, updated_at, shelf_id)
SELECT movie_id, @owner, device_id, watched, updated_at, shelf_id FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY movie_id ORDER BY watched DESC, updated_at DESC, rowid DESC) AS rank FROM movie_watch_state
) WHERE rank = 1`;

const indexes = `
CREATE INDEX IF NOT EXISTS idx_playback_progress_device ON playback_progress (device_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_playback_progress_profile ON playback_progress (profile_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_movie_watch_state_profile ON movie_watch_state (profile_id);
`;

function hasProfileId(db: Database.Database, table: string): boolean {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).some((column) => column.name === 'profile_id');
}

/**
 * Re-keys progress and watch state from (movie, device) to (movie, profile). Old rows all go to the owner profile;
 * `device_id` stays as the "last device". Runs once per table: a table that already has `profile_id` is left alone.
 */
export function ensureProfileScope(db: Database.Database): void {
  const progressDone = hasProfileId(db, 'playback_progress');
  const watchDone = hasProfileId(db, 'movie_watch_state');
  if (progressDone && watchDone) { db.exec(indexes); return; }
  const owner = (db.prepare('SELECT id FROM profiles WHERE is_owner = 1 ORDER BY id LIMIT 1').get() as { id: number } | undefined)?.id;
  if (owner === undefined) throw new Error('Migration 020 needs the owner profile from 019');
  db.transaction(() => {
    if (!progressDone) {
      db.exec(progressTable);
      db.prepare(copyProgress).run({ owner });
      db.exec('DROP TABLE playback_progress; ALTER TABLE playback_progress_new RENAME TO playback_progress;');
    }
    if (!watchDone) {
      db.exec(watchTable);
      db.prepare(copyWatchState).run({ owner });
      db.exec('DROP TABLE movie_watch_state; ALTER TABLE movie_watch_state_new RENAME TO movie_watch_state;');
    }
    db.exec(indexes);
  })();
}
