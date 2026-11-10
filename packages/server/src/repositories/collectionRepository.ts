import type Database from 'better-sqlite3';
import type { CollectionPart } from '../providers/metadata/MetadataProvider.js';

export interface StoredCollection { name: string; parts: CollectionPart[]; fetchedAt: string }

export class CollectionRepository {
  public constructor(private readonly db: Database.Database) {}

  public get(id: number): StoredCollection | undefined {
    const row = this.db.prepare('SELECT name, parts_json, fetched_at FROM collections WHERE collection_id = ?').get(id) as { name: string; parts_json: string | null; fetched_at: string | null } | undefined;
    return row && row.parts_json !== null && row.fetched_at !== null ? { name: row.name, parts: JSON.parse(row.parts_json) as CollectionPart[], fetchedAt: row.fetched_at } : undefined;
  }

  public put(id: number, name: string, parts: CollectionPart[], fetchedAt: string): void {
    this.db.prepare(`INSERT INTO collections (collection_id, name, parts_json, fetched_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(collection_id) DO UPDATE SET name = excluded.name, parts_json = excluded.parts_json, fetched_at = excluded.fetched_at`)
      .run(id, name, JSON.stringify(parts), fetchedAt);
  }
}
