import type Database from 'better-sqlite3';

// The real picture area inside the video frame (black bars burned into the encode), in source pixels.
// picture_status: pending (not measured yet) | done (area stored) | none (no bars) | failed (could not measure).
// Existing rows start pending, which is the backfill: the detection pass picks them up.
const pictureColumns: Array<[string, string]> = [
  ['picture_x', 'INTEGER'],
  ['picture_y', 'INTEGER'],
  ['picture_width', 'INTEGER'],
  ['picture_height', 'INTEGER'],
  ['picture_status', "TEXT NOT NULL DEFAULT 'pending'"]
];

export function ensurePictureArea(db: Database.Database): void {
  const existing = new Set((db.prepare('PRAGMA table_info(movies)').all() as Array<{ name: string }>).map((column) => column.name));
  for (const [name, definition] of pictureColumns) {
    if (!existing.has(name)) db.exec(`ALTER TABLE movies ADD COLUMN ${name} ${definition}`);
  }
}
