import type Database from 'better-sqlite3';

export interface ProfileRecord { id: number; name: string; color: string; pinHash: string | null; isOwner: boolean; createdAt: string }

interface ProfileRow { id: number; name: string; color: string; pin_hash: string | null; is_owner: number; created_at: string }

const columns = 'id, name, color, pin_hash, is_owner, created_at';

function toRecord(row: ProfileRow): ProfileRecord {
  return { id: row.id, name: row.name, color: row.color, pinHash: row.pin_hash, isOwner: row.is_owner === 1, createdAt: row.created_at };
}

/** Viewer profiles. Deleting one cascades its sessions, hides and playback history (foreign keys are on). */
export class ProfileRepository {
  public constructor(private readonly db: Database.Database) {}

  public list(): ProfileRecord[] {
    return (this.db.prepare(`SELECT ${columns} FROM profiles ORDER BY id`).all() as ProfileRow[]).map(toRecord);
  }

  public get(id: number): ProfileRecord | undefined {
    const row = this.db.prepare(`SELECT ${columns} FROM profiles WHERE id = ?`).get(id) as ProfileRow | undefined;
    return row && toRecord(row);
  }

  public getOwner(): ProfileRecord | undefined {
    const row = this.db.prepare(`SELECT ${columns} FROM profiles WHERE is_owner = 1 ORDER BY id LIMIT 1`).get() as ProfileRow | undefined;
    return row && toRecord(row);
  }

  public count(): number {
    return (this.db.prepare('SELECT COUNT(*) AS count FROM profiles').get() as { count: number }).count;
  }

  public create(input: { name: string; color: string; pinHash: string | null }): ProfileRecord {
    const result = this.db.prepare("INSERT INTO profiles (name, color, pin_hash, is_owner, created_at) VALUES (?, ?, ?, 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))")
      .run(input.name, input.color, input.pinHash);
    return this.get(Number(result.lastInsertRowid))!;
  }

  public update(id: number, patch: { name?: string; color?: string }): void {
    if (patch.name !== undefined) this.db.prepare('UPDATE profiles SET name = ? WHERE id = ?').run(patch.name, id);
    if (patch.color !== undefined) this.db.prepare('UPDATE profiles SET color = ? WHERE id = ?').run(patch.color, id);
  }

  public setPinHash(id: number, pinHash: string | null): void {
    this.db.prepare('UPDATE profiles SET pin_hash = ? WHERE id = ?').run(pinHash, id);
  }

  public delete(id: number): void {
    this.db.prepare('DELETE FROM profiles WHERE id = ?').run(id);
  }
}
