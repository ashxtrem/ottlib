import { createHash } from 'node:crypto';
import type Database from 'better-sqlite3';

/** How a session token is stored: its SHA-256, hex-encoded. */
export const sessionTokenHash = (token: string): string => createHash('sha256').update(token).digest('hex');

export interface ProfileSession { profileId: number; deviceId: string | null; lastSeenAt: string }

/** Profile sign-ins, stored only as SHA-256 hashes of their session tokens. */
export class ProfileSessionRepository {
  public constructor(private readonly db: Database.Database) {}

  public create(tokenHash: string, profileId: number, deviceId: string | null): void {
    this.db.prepare(`INSERT INTO profile_sessions (token_hash, profile_id, device_id, created_at, last_seen_at)
      VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`).run(tokenHash, profileId, deviceId);
  }

  public find(tokenHash: string): ProfileSession | undefined {
    return this.db.prepare('SELECT profile_id AS profileId, device_id AS deviceId, last_seen_at AS lastSeenAt FROM profile_sessions WHERE token_hash = ?')
      .get(tokenHash) as ProfileSession | undefined;
  }

  public touch(tokenHash: string, now: string): void {
    this.db.prepare('UPDATE profile_sessions SET last_seen_at = ? WHERE token_hash = ?').run(now, tokenHash);
  }

  public delete(tokenHash: string): void {
    this.db.prepare('DELETE FROM profile_sessions WHERE token_hash = ?').run(tokenHash);
  }

  public deleteForProfile(profileId: number): void {
    this.db.prepare('DELETE FROM profile_sessions WHERE profile_id = ?').run(profileId);
  }

  /** Signs a profile out everywhere except the one session with `keepTokenHash`. */
  public deleteForProfileExcept(profileId: number, keepTokenHash: string): void {
    this.db.prepare('DELETE FROM profile_sessions WHERE profile_id = ? AND token_hash <> ?').run(profileId, keepTokenHash);
  }
}
