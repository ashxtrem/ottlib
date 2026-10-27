import type Database from 'better-sqlite3';

/** Per-profile auto-skip-credits choices, keyed by scope: `default:movie`, `default:tv`, `movie:<id>` or a show key. */
export class AutoSkipRepository {
  public constructor(private readonly db: Database.Database) {}

  /** The stored choice, or undefined when the profile has none for this scope. */
  public get(profileId: number, scopeKey: string): boolean | undefined {
    const row = this.db.prepare('SELECT enabled FROM profile_auto_skip WHERE profile_id = ? AND scope_key = ?').get(profileId, scopeKey) as { enabled: number } | undefined;
    return row ? row.enabled === 1 : undefined;
  }

  public set(profileId: number, scopeKey: string, enabled: boolean): void {
    this.db.prepare(`INSERT INTO profile_auto_skip (profile_id, scope_key, enabled) VALUES (?, ?, ?)
      ON CONFLICT(profile_id, scope_key) DO UPDATE SET enabled = excluded.enabled`).run(profileId, scopeKey, enabled ? 1 : 0);
  }

  public clear(profileId: number, scopeKey: string): void {
    this.db.prepare('DELETE FROM profile_auto_skip WHERE profile_id = ? AND scope_key = ?').run(profileId, scopeKey);
  }
}
