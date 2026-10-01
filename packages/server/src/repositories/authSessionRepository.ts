import type Database from 'better-sqlite3';

/** Signed-in devices, stored only as SHA-256 hashes of their session tokens. */
export class AuthSessionRepository {
  public constructor(private readonly db: Database.Database) {}

  public add(tokenHash: string): void { this.db.prepare('INSERT INTO auth_sessions (token_hash) VALUES (?)').run(tokenHash); }
  public exists(tokenHash: string): boolean { return Boolean(this.db.prepare('SELECT 1 FROM auth_sessions WHERE token_hash = ?').get(tokenHash)); }
  public remove(tokenHash: string): void { this.db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(tokenHash); }
  public clear(): void { this.db.prepare('DELETE FROM auth_sessions').run(); }
}
