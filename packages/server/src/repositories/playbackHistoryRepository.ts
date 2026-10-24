import type Database from 'better-sqlite3';
import type { PlayMethod } from '@ottlib/shared';

export interface PlaybackHistoryEntry {
  id: number; profileId: number; movieId: number; deviceId: string | null; method: PlayMethod;
  startedAt: string; endedAt: string | null; startPositionMs: number; endPositionMs: number | null; completed: boolean;
}

interface HistoryRow extends Omit<PlaybackHistoryEntry, 'completed'> { completed: number }

export interface StartPlayback { profileId: number; movieId: number; deviceId: string | null; method: PlayMethod; startPositionMs: number }
export interface FinishPlayback { endPositionMs: number; endedAt: string; completed: boolean }

/** One row per playback session a profile starts; finished when the player reports back. */
export class PlaybackHistoryRepository {
  public constructor(private readonly db: Database.Database) {}

  public start(input: StartPlayback): number {
    const result = this.db.prepare(`INSERT INTO playback_history (profile_id, movie_id, device_id, method, started_at, start_position_ms)
      VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), ?)`).run(input.profileId, input.movieId, input.deviceId, input.method, input.startPositionMs);
    return Number(result.lastInsertRowid);
  }

  /** The most recent unfinished session for this title that started at or after `sinceIso`. */
  public latestOpen(profileId: number, movieId: number, sinceIso: string): PlaybackHistoryEntry | null {
    const row = this.db.prepare(`SELECT id, profile_id AS profileId, movie_id AS movieId, device_id AS deviceId, method, started_at AS startedAt, ended_at AS endedAt,
        start_position_ms AS startPositionMs, end_position_ms AS endPositionMs, completed
      FROM playback_history WHERE profile_id = ? AND movie_id = ? AND ended_at IS NULL AND started_at >= ?
      ORDER BY started_at DESC, id DESC LIMIT 1`).get(profileId, movieId, sinceIso) as HistoryRow | undefined;
    return row ? { ...row, completed: row.completed === 1 } : null;
  }

  public finish(id: number, result: FinishPlayback): void {
    this.db.prepare('UPDATE playback_history SET end_position_ms = ?, ended_at = ?, completed = ? WHERE id = ?')
      .run(result.endPositionMs, result.endedAt, result.completed ? 1 : 0, id);
  }

  public countFor(profileId: number, movieId: number): number {
    return (this.db.prepare('SELECT COUNT(*) AS count FROM playback_history WHERE profile_id = ? AND movie_id = ?').get(profileId, movieId) as { count: number }).count;
  }

  public lastPlayedAt(profileId: number, movieId: number): string | null {
    const row = this.db.prepare('SELECT MAX(started_at) AS lastPlayedAt FROM playback_history WHERE profile_id = ? AND movie_id = ?').get(profileId, movieId) as { lastPlayedAt: string | null };
    return row.lastPlayedAt;
  }
}
