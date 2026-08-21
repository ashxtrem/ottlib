import type Database from 'better-sqlite3';

export interface FolderRecord { id: number; path: string; enabled: boolean; createdAt: string }

export class FolderRepository {
  public constructor(private readonly db: Database.Database) {}

  public list(): FolderRecord[] {
    return this.db.prepare('SELECT id, path, enabled, created_at FROM folders WHERE enabled = 1 ORDER BY path').all().map(this.map);
  }

  public get(id: number): FolderRecord | undefined {
    const row = this.db.prepare('SELECT id, path, enabled, created_at FROM folders WHERE id = ?').get(id);
    return row ? this.map(row) : undefined;
  }

  public create(path: string): FolderRecord {
    const result = this.db.prepare('INSERT INTO folders (path) VALUES (?)').run(path);
    return this.get(Number(result.lastInsertRowid))!;
  }

  public remove(id: number): void { this.db.prepare('UPDATE folders SET enabled = 0 WHERE id = ?').run(id); }

  private map = (row: any): FolderRecord => ({ id: row.id, path: row.path, enabled: Boolean(row.enabled), createdAt: row.created_at });
}
