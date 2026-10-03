import type Database from 'better-sqlite3';

export interface DownloadedSubtitle {
  id: number; movie_id: number; provider: string; remote_id: string; language: string;
  release_name: string; format: string; path: string; sidecar_path: string | null;
  hearing_impaired: number; forced: number;
}
export class DownloadedSubtitleRepository {
  constructor(private readonly db: Database.Database) {}
  list(movieId: number): DownloadedSubtitle[] {
    return this.db.prepare('SELECT * FROM downloaded_subtitles WHERE movie_id = ? ORDER BY id').all(movieId) as DownloadedSubtitle[];
  }
  find(movieId: number, provider: string, remoteId: string): DownloadedSubtitle | undefined {
    return this.db.prepare('SELECT * FROM downloaded_subtitles WHERE movie_id = ? AND provider = ? AND remote_id = ?').get(movieId, provider, remoteId) as DownloadedSubtitle | undefined;
  }
  get(movieId: number, id: number): DownloadedSubtitle | undefined {
    return this.db.prepare('SELECT * FROM downloaded_subtitles WHERE movie_id = ? AND id = ?').get(movieId, id) as DownloadedSubtitle | undefined;
  }
  save(record: Omit<DownloadedSubtitle, 'id'>): DownloadedSubtitle {
    this.db.prepare(`INSERT INTO downloaded_subtitles (movie_id, provider, remote_id, language, release_name, format, path, sidecar_path, hearing_impaired, forced)
      VALUES (@movie_id, @provider, @remote_id, @language, @release_name, @format, @path, @sidecar_path, @hearing_impaired, @forced)
      ON CONFLICT(movie_id, provider, remote_id) DO UPDATE SET path = excluded.path, sidecar_path = excluded.sidecar_path,
      format = excluded.format, release_name = excluded.release_name, language = excluded.language,
      hearing_impaired = excluded.hearing_impaired, forced = excluded.forced`).run(record);
    return this.find(record.movie_id, record.provider, record.remote_id)!;
  }
}
