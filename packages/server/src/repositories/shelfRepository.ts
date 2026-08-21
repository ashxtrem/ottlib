import type Database from 'better-sqlite3';

export interface ShelfRecord {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface ShelfRow {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export class ShelfRepository {
  public constructor(private readonly db: Database.Database) {}

  public list(): ShelfRecord[] {
    const rows = this.db.prepare('SELECT id, name, created_at, updated_at FROM shelves ORDER BY created_at DESC, id DESC').all() as ShelfRow[];
    return rows.map(this.map);
  }

  public get(id: number): ShelfRecord | undefined {
    const row = this.db.prepare('SELECT id, name, created_at, updated_at FROM shelves WHERE id = ?').get(id) as ShelfRow | undefined;
    return row && this.map(row);
  }

  public exists(id: number): boolean {
    return Boolean(this.db.prepare('SELECT 1 FROM shelves WHERE id = ?').get(id));
  }

  public nameExists(name: string, excludingId?: number): boolean {
    const row = excludingId === undefined
      ? this.db.prepare('SELECT 1 FROM shelves WHERE name = ? COLLATE NOCASE').get(name)
      : this.db.prepare('SELECT 1 FROM shelves WHERE name = ? COLLATE NOCASE AND id <> ?').get(name, excludingId);
    return Boolean(row);
  }

  public create(name: string): ShelfRecord {
    const result = this.db.prepare('INSERT INTO shelves (name) VALUES (?)').run(name);
    return this.get(Number(result.lastInsertRowid))!;
  }

  public rename(id: number, name: string): ShelfRecord | undefined {
    this.db.prepare('UPDATE shelves SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(name, id);
    return this.get(id);
  }

  public touch(id: number): void {
    this.db.prepare('UPDATE shelves SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
  }

  public remove(id: number): boolean {
    return this.db.prepare('DELETE FROM shelves WHERE id = ?').run(id).changes > 0;
  }

  public transaction<T>(work: () => T): T {
    return this.db.transaction(work)();
  }

  private map = (row: ShelfRow): ShelfRecord => ({ id: row.id, name: row.name, createdAt: row.created_at, updatedAt: row.updated_at });
}
