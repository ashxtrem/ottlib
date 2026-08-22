import type Database from 'better-sqlite3';

export function ensureRunKind(db: Database.Database): void {
  const columns = db.prepare('PRAGMA table_info(scan_runs)').all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === 'kind')) db.exec("ALTER TABLE scan_runs ADD COLUMN kind TEXT NOT NULL DEFAULT 'scan'");
}
