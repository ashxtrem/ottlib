import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { ensureStreamSecretRotated } from './021_stream_secret_rotation.js';

const oldSecret = 'a'.repeat(64);

function preMigrationDb(withRow: boolean) {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE access_pin (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    pin_hash TEXT NOT NULL,
    stream_secret TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  if (withRow) db.prepare('INSERT INTO access_pin (id, pin_hash, stream_secret) VALUES (1, ?, ?)').run('hash', oldSecret);
  return db;
}

const secretOf = (db: Database.Database) => (db.prepare('SELECT stream_secret FROM access_pin WHERE id = 1').get() as { stream_secret: string }).stream_secret;

describe('021 stream secret rotation', () => {
  it('replaces an existing secret with a fresh 64-hex value on the first run', () => {
    const db = preMigrationDb(true);
    try {
      ensureStreamSecretRotated(db);
      const secret = secretOf(db);
      expect(secret).toMatch(/^[0-9a-f]{64}$/);
      expect(secret).not.toBe(oldSecret);
      expect(db.prepare('SELECT secret_version FROM access_pin WHERE id = 1').get()).toEqual({ secret_version: 1 });
    } finally { db.close(); }
  });

  it('leaves the secret alone on later runs', () => {
    const db = preMigrationDb(true);
    try {
      ensureStreamSecretRotated(db);
      const rotated = secretOf(db);
      ensureStreamSecretRotated(db);
      ensureStreamSecretRotated(db);
      expect(secretOf(db)).toBe(rotated);
    } finally { db.close(); }
  });

  it('is fine with no PIN row and does not create one', () => {
    const db = preMigrationDb(false);
    try {
      ensureStreamSecretRotated(db);
      ensureStreamSecretRotated(db);
      expect(db.prepare('SELECT COUNT(*) AS count FROM access_pin').get()).toEqual({ count: 0 });
    } finally { db.close(); }
  });
});
