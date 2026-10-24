import type Database from 'better-sqlite3';

/** Resume point of one title for one profile. `deviceId` is the device that wrote it last, if it said. */
export interface PlaybackProgress { movieId: number; profileId: number; deviceId: string | null; positionMs: number; durationMs: number; updatedAt: string; shelfId: number | null }

export class PlaybackProgressRepository {
  public constructor(private readonly db: Database.Database) {}

  public get(movieId: number, profileId: number): PlaybackProgress | undefined {
    const row = this.db.prepare(`SELECT movie_id AS movieId, profile_id AS profileId, device_id AS deviceId, position_ms AS positionMs, duration_ms AS durationMs, updated_at AS updatedAt, shelf_id AS shelfId
      FROM playback_progress WHERE movie_id = ? AND profile_id = ?`).get(movieId, profileId) as PlaybackProgress | undefined;
    return row;
  }

  public set(movieId: number, profileId: number, deviceId: string | null, positionMs: number, durationMs: number, shelfId?: number): void {
    this.db.prepare(`INSERT INTO playback_progress (movie_id, profile_id, device_id, position_ms, duration_ms, updated_at)
      VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ON CONFLICT(movie_id, profile_id) DO UPDATE SET device_id = excluded.device_id, position_ms = excluded.position_ms, duration_ms = excluded.duration_ms, updated_at = excluded.updated_at`)
      .run(movieId, profileId, deviceId, positionMs, durationMs);
    if (shelfId !== undefined) this.setShelf(movieId, profileId, shelfId);
  }

  public clear(movieId: number, profileId: number): void {
    this.db.prepare('DELETE FROM playback_progress WHERE movie_id = ? AND profile_id = ?').run(movieId, profileId);
  }

  /** Zero is an unstarted next title, rather than fabricated viewing progress. */
  public queue(movieId: number, profileId: number, deviceId: string | null, durationMs: number, shelfId?: number): void {
    if (!this.get(movieId, profileId)) this.set(movieId, profileId, deviceId, 0, durationMs, shelfId);
  }

  public transaction<T>(work: () => T): T { return this.db.transaction(work)(); }

  private setShelf(movieId: number, profileId: number, shelfId: number): void {
    this.db.prepare('UPDATE playback_progress SET shelf_id = ? WHERE movie_id = ? AND profile_id = ?').run(shelfId, movieId, profileId);
  }
}
