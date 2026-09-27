import type Database from 'better-sqlite3';

export interface PlaybackProgress { movieId: number; deviceId: string; positionMs: number; durationMs: number; updatedAt: string }

export class PlaybackProgressRepository {
  public constructor(private readonly db: Database.Database) {}

  public get(movieId: number, deviceId: string): PlaybackProgress | undefined {
    const row = this.db.prepare(`SELECT movie_id AS movieId, device_id AS deviceId, position_ms AS positionMs, duration_ms AS durationMs, updated_at AS updatedAt
      FROM playback_progress WHERE movie_id = ? AND device_id = ?`).get(movieId, deviceId) as PlaybackProgress | undefined;
    return row;
  }

  public set(movieId: number, deviceId: string, positionMs: number, durationMs: number): void {
    this.db.prepare(`INSERT INTO playback_progress (movie_id, device_id, position_ms, duration_ms, updated_at)
      VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ON CONFLICT(movie_id, device_id) DO UPDATE SET position_ms = excluded.position_ms, duration_ms = excluded.duration_ms, updated_at = excluded.updated_at`)
      .run(movieId, deviceId, positionMs, durationMs);
  }

  public clear(movieId: number, deviceId: string): void {
    this.db.prepare('DELETE FROM playback_progress WHERE movie_id = ? AND device_id = ?').run(movieId, deviceId);
  }
}
