import type Database from 'better-sqlite3';

export function ensureScanTitlesAdded(db: Database.Database): void {
  const columns = db.prepare('PRAGMA table_info(scan_runs)').all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === 'titles_added')) db.exec('ALTER TABLE scan_runs ADD COLUMN titles_added INTEGER NOT NULL DEFAULT 0');
}
