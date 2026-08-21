import type Database from 'better-sqlite3';

export class WatchStateRepository {
  public constructor(private readonly db: Database.Database) {}

  public set(movieId: number, deviceId: string, watched: boolean): void {
    this.db.prepare(`INSERT INTO movie_watch_state (movie_id, device_id, watched, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(movie_id, device_id) DO UPDATE SET watched = excluded.watched, updated_at = excluded.updated_at`).run(movieId, deviceId, Number(watched));
  }
}
