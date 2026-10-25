import { randomBytes } from 'node:crypto';
import type Database from 'better-sqlite3';

// The stream secret signs every ?key= URL. Copies of older databases may have leaked,
// so replace it exactly once per database; secret_version marks that this ran.
export function ensureStreamSecretRotated(db: Database.Database): void {
  const columns = db.prepare('PRAGMA table_info(access_pin)').all() as Array<{ name: string }>;
  if (columns.some((column) => column.name === 'secret_version')) return;
  db.transaction(() => {
    db.exec('ALTER TABLE access_pin ADD COLUMN secret_version INTEGER NOT NULL DEFAULT 1');
    db.prepare('UPDATE access_pin SET stream_secret = ?').run(randomBytes(32).toString('hex'));
  })();
}
