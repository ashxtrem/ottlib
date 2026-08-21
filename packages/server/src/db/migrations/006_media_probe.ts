import type Database from 'better-sqlite3';

const movieColumns: Array<[string, string]> = [
  ['media_probe_status', "TEXT NOT NULL DEFAULT 'pending'"],
  ['media_probe_error', 'TEXT'],
  ['media_probed_at', 'TEXT'],
  ['container_format', 'TEXT'],
  ['duration_ms', 'INTEGER'],
  ['video_width', 'INTEGER'],
  ['video_height', 'INTEGER'],
  ['video_codec', 'TEXT'],
  ['video_profile', 'TEXT'],
  ['video_bit_rate', 'INTEGER'],
  ['hdr_format', 'TEXT']
];

export function ensureMediaProbeSchema(db: Database.Database): void {
  const existing = new Set((db.prepare('PRAGMA table_info(movies)').all() as Array<{ name: string }>).map((column) => column.name));
  for (const [name, definition] of movieColumns) {
    if (!existing.has(name)) db.exec(`ALTER TABLE movies ADD COLUMN ${name} ${definition}`);
  }
  db.exec(`CREATE TABLE IF NOT EXISTS media_tracks (
    id INTEGER PRIMARY KEY,
    movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    track_type TEXT NOT NULL,
    track_source TEXT NOT NULL,
    track_order INTEGER NOT NULL,
    language TEXT,
    title TEXT,
    codec TEXT,
    channels INTEGER,
    channel_layout TEXT,
    is_default INTEGER NOT NULL DEFAULT 0,
    is_forced INTEGER NOT NULL DEFAULT 0,
    is_hearing_impaired INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS media_tracks_movie_order_idx ON media_tracks (movie_id, track_order);`);
}
