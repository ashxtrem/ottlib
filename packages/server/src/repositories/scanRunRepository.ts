import type Database from 'better-sqlite3';
import type { ScanRun } from '@ottlib/shared';

export class ScanRunRepository {
  public constructor(private readonly db: Database.Database) {}

  public active(): ScanRun | undefined {
    const row = this.db.prepare("SELECT * FROM scan_runs WHERE status = 'running' ORDER BY id DESC LIMIT 1").get();
    return row ? this.map(row) : undefined;
  }

  public latest(): ScanRun | undefined {
    const row = this.db.prepare('SELECT * FROM scan_runs ORDER BY id DESC LIMIT 1').get();
    return row ? this.map(row) : undefined;
  }

  public failAbandonedRuns(): void {
    this.db.prepare("UPDATE scan_runs SET status = 'failed', finished_at = CURRENT_TIMESTAMP, error_summary = COALESCE(error_summary, 'Scan interrupted by server restart') WHERE status = 'running'").run();
  }

  public list(limit = 20): ScanRun[] { return (this.db.prepare('SELECT * FROM scan_runs ORDER BY id DESC LIMIT ?').all(limit) as any[]).map(this.map); }

  public create(): ScanRun {
    const result = this.db.prepare("INSERT INTO scan_runs (status) VALUES ('running')").run();
    return this.get(Number(result.lastInsertRowid))!;
  }

  public progress(id: number, filesFound: number, filesProcessed: number, titlesAdded: number): void {
    this.db.prepare('UPDATE scan_runs SET files_found = ?, files_processed = ?, titles_added = ? WHERE id = ?').run(filesFound, filesProcessed, titlesAdded, id);
  }

  public finish(id: number, status: 'completed' | 'failed', errorSummary: string | null = null): ScanRun {
    this.db.prepare('UPDATE scan_runs SET status = ?, finished_at = CURRENT_TIMESTAMP, error_summary = ? WHERE id = ?').run(status, errorSummary, id);
    return this.get(id)!;
  }

  public get(id: number): ScanRun | undefined { const row = this.db.prepare('SELECT * FROM scan_runs WHERE id = ?').get(id); return row ? this.map(row) : undefined; }

  private map = (row: any): ScanRun => ({
    id: row.id, status: row.status, startedAt: row.started_at, finishedAt: row.finished_at,
    filesFound: row.files_found, filesProcessed: row.files_processed, titlesAdded: row.titles_added, errorSummary: row.error_summary
  });
}
