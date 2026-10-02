import type Database from 'better-sqlite3';

export function ensurePlaybackCollection(db: Database.Database): void {
  const columns = db.prepare('PRAGMA table_info(playback_progress)').all() as Array<{ name: string }>;
  if (!columns.some(column => column.name === 'shelf_id')) {
    db.exec('ALTER TABLE playback_progress ADD COLUMN shelf_id INTEGER REFERENCES shelves(id) ON DELETE SET NULL');
  }
  const watchColumns = db.prepare('PRAGMA table_info(movie_watch_state)').all() as Array<{ name: string }>;
  if (!watchColumns.some(column => column.name === 'shelf_id')) {
    db.exec('ALTER TABLE movie_watch_state ADD COLUMN shelf_id INTEGER REFERENCES shelves(id) ON DELETE SET NULL');
  }
}
