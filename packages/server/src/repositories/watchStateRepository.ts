import type Database from 'better-sqlite3';

/** Watched marks per (title, profile). `device_id` records the device that last changed the mark, if it said. */
export class WatchStateRepository {
  public constructor(private readonly db: Database.Database) {}

  public set(movieId: number, profileId: number, watched: boolean, deviceId: string | null = null): void {
    this.db.prepare(`INSERT INTO movie_watch_state (movie_id, profile_id, device_id, watched, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(movie_id, profile_id) DO UPDATE SET device_id = excluded.device_id, watched = excluded.watched, updated_at = excluded.updated_at`).run(movieId, profileId, deviceId, Number(watched));
  }

  public get(movieId: number, profileId: number): boolean {
    const row = this.db.prepare('SELECT watched FROM movie_watch_state WHERE movie_id = ? AND profile_id = ?').get(movieId, profileId) as { watched: number } | undefined;
    return Boolean(row?.watched);
  }

  public collectionId(movieId: number, profileId: number): number | undefined {
    const row = this.db.prepare('SELECT shelf_id FROM movie_watch_state WHERE movie_id = ? AND profile_id = ?').get(movieId, profileId) as { shelf_id: number | null } | undefined;
    return row?.shelf_id ?? undefined;
  }

  public setCollection(movieId: number, profileId: number, shelfId: number): void {
    this.db.prepare('UPDATE movie_watch_state SET shelf_id = ? WHERE movie_id = ? AND profile_id = ?').run(shelfId, movieId, profileId);
  }
}
