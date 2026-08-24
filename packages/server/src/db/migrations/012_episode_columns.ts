import type Database from 'better-sqlite3';

export function ensureEpisodeColumns(db: Database.Database): void {
  const columns = new Set((db.prepare('PRAGMA table_info(movies)').all() as Array<{ name: string }>).map((column) => column.name));
  if (!columns.has('season')) db.exec('ALTER TABLE movies ADD COLUMN season INTEGER');
  if (!columns.has('episode')) db.exec('ALTER TABLE movies ADD COLUMN episode INTEGER');

  const rows = db.prepare("SELECT id, metadata_title FROM movies WHERE metadata_media_type = 'tv' AND season IS NULL").all() as Array<{ id: number; metadata_title: string | null }>;
  const update = db.prepare('UPDATE movies SET season = ?, episode = ? WHERE id = ?');
  for (const row of rows) {
    const match = /\bS(\d+)E(\d+)\b/i.exec(row.metadata_title ?? '');
    if (match) update.run(Number(match[1]), Number(match[2]), row.id);
  }
}
