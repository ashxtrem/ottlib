import type Database from 'better-sqlite3';

/** Per-profile hidden titles, keyed by `hideKeyOf` (a show key or `m:<movieId>`). */
export class HideRepository {
  public constructor(private readonly db: Database.Database) {}

  /** Newest hide first. */
  public list(profileId: number): string[] {
    const rows = this.db.prepare('SELECT hide_key AS hideKey FROM movie_hides WHERE profile_id = ? ORDER BY created_at DESC, rowid DESC').all(profileId) as Array<{ hideKey: string }>;
    return rows.map((row) => row.hideKey);
  }

  public add(profileId: number, key: string): void { this.addMany(profileId, [key]); }

  /** Keys already hidden are left as they are, so they keep their original position. One transaction. */
  public addMany(profileId: number, keys: string[]): void {
    const insert = this.db.prepare("INSERT OR IGNORE INTO movie_hides (profile_id, hide_key, created_at) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))");
    this.db.transaction(() => { for (const key of keys) insert.run(profileId, key); })();
  }

  public remove(profileId: number, key: string): void {
    this.db.prepare('DELETE FROM movie_hides WHERE profile_id = ? AND hide_key = ?').run(profileId, key);
  }

  public count(profileId: number): number {
    return (this.db.prepare('SELECT COUNT(*) AS count FROM movie_hides WHERE profile_id = ?').get(profileId) as { count: number }).count;
  }

  /** Keeps the newest `max` hides and drops the older ones. */
  public trimTo(profileId: number, max: number): void {
    this.db.prepare(`DELETE FROM movie_hides WHERE profile_id = ? AND rowid NOT IN (
      SELECT rowid FROM movie_hides WHERE profile_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?)`).run(profileId, profileId, Math.max(0, max));
  }
}
