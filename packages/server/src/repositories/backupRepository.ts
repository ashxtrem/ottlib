import Database from 'better-sqlite3';
import { vacuumInto } from '../db/backupFile.js';

/** Runs the SQLite side of a backup: writing a copy of the live database and checking a copy before a restore trusts it. */
export class BackupRepository {
  public constructor(private readonly db: Database.Database) {}

  /** Writes a consistent copy of the live database to `path`, replacing a file already there. */
  public writeCopy(path: string): void {
    vacuumInto(this.db, path);
  }

  /** Opens `path` read-only; returns why it can't be restored from, or null when it passes `quick_check` and has a `movies` table. */
  public problemWith(path: string): string | null {
    let copy: Database.Database | undefined;
    try {
      copy = new Database(path, { readonly: true, fileMustExist: true });
      const result = copy.pragma('quick_check', { simple: true });
      if (result !== 'ok') return `The backup failed its integrity check (${String(result)})`;
      const movies = copy.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'movies'").get();
      return movies ? null : 'The backup has no movies table';
    } catch (error) {
      return `The backup can't be opened as a database (${error instanceof Error ? error.message : 'unknown error'})`;
    } finally {
      copy?.close();
    }
  }
}
