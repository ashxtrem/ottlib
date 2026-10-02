import type Database from 'better-sqlite3';

export class WatchStateRepository {
  public constructor(private readonly db: Database.Database) {}

  public set(movieId: number, deviceId: string, watched: boolean): void {
    this.db.prepare(`INSERT INTO movie_watch_state (movie_id, device_id, watched, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(movie_id, device_id) DO UPDATE SET watched = excluded.watched, updated_at = excluded.updated_at`).run(movieId, deviceId, Number(watched));
  }

  public get(movieId: number, deviceId: string): boolean {
    const row = this.db.prepare('SELECT watched FROM movie_watch_state WHERE movie_id = ? AND device_id = ?').get(movieId, deviceId) as { watched: number } | undefined;
    return Boolean(row?.watched);
  }

  public collectionId(movieId: number, deviceId: string): number | undefined {
    const row = this.db.prepare('SELECT shelf_id FROM movie_watch_state WHERE movie_id = ? AND device_id = ?').get(movieId, deviceId) as { shelf_id: number | null } | undefined;
    return row?.shelf_id ?? undefined;
  }

  public setCollection(movieId: number, deviceId: string, shelfId: number): void {
    this.db.prepare('UPDATE movie_watch_state SET shelf_id = ? WHERE movie_id = ? AND device_id = ?').run(shelfId, movieId, deviceId);
  }
}
