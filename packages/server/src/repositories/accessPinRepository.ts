import type Database from 'better-sqlite3';

export interface AccessPinRecord { pinHash: string; streamSecret: string }

/** The single optional access PIN (row id 1) and the secret its stream links are signed with. */
export class AccessPinRepository {
  public constructor(private readonly db: Database.Database) {}

  public get(): AccessPinRecord | undefined {
    const row = this.db.prepare('SELECT pin_hash, stream_secret FROM access_pin WHERE id = 1').get() as { pin_hash: string; stream_secret: string } | undefined;
    return row && { pinHash: row.pin_hash, streamSecret: row.stream_secret };
  }

  public set(record: AccessPinRecord): void {
    this.db.prepare(`INSERT INTO access_pin (id, pin_hash, stream_secret, updated_at) VALUES (1, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET pin_hash = excluded.pin_hash, stream_secret = excluded.stream_secret, updated_at = excluded.updated_at`).run(record.pinHash, record.streamSecret);
  }

  public clear(): void { this.db.prepare('DELETE FROM access_pin').run(); }
}
