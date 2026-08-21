import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { initialMigration } from './migrations/001_initial.js';
import { matchCandidatesMigration } from './migrations/002_match_candidates.js';
import { ensureCandidateMediaType } from './migrations/003_candidate_media_type.js';
import { ensureImdbId } from './migrations/004_imdb_id.js';
import { shelvesMigration } from './migrations/005_shelves.js';
import { ensureMediaProbeSchema } from './migrations/006_media_probe.js';

export function createDatabase(appDataPath: string): Database.Database {
  mkdirSync(appDataPath, { recursive: true });
  const db = new Database(join(appDataPath, 'library.sqlite'));
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.exec(initialMigration);
  db.exec(matchCandidatesMigration);
  ensureCandidateMediaType(db);
  ensureImdbId(db);
  db.exec(shelvesMigration);
  ensureMediaProbeSchema(db);
  return db;
}
