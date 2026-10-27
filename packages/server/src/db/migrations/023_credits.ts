import type Database from 'better-sqlite3';

// Where a file's end credits start. credits_chapter_ms comes from a chapter named for the credits (credits_status
// 'pending' until the chapter pass has read the file, then 'done'); credits_mark_ms is a user's "credits start here".
const creditsColumns: Array<[string, string]> = [
  ['credits_chapter_ms', 'INTEGER'],
  ['credits_mark_ms', 'INTEGER'],
  ['credits_status', "TEXT NOT NULL DEFAULT 'pending'"]
];

// Per-profile auto-skip choices. scope_key is `default:movie`, `default:tv`, `movie:<id>` or a show key (`tv:...`).
const autoSkipSchema = `
CREATE TABLE IF NOT EXISTS profile_auto_skip (
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  scope_key TEXT NOT NULL,
  enabled INTEGER NOT NULL,
  PRIMARY KEY (profile_id, scope_key)
);
`;

export function ensureCredits(db: Database.Database): void {
  const existing = new Set((db.prepare('PRAGMA table_info(movies)').all() as Array<{ name: string }>).map((column) => column.name));
  for (const [name, definition] of creditsColumns) {
    if (!existing.has(name)) db.exec(`ALTER TABLE movies ADD COLUMN ${name} ${definition}`);
  }
  db.exec(autoSkipSchema);
}
