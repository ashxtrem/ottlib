import type Database from 'better-sqlite3';
import type { MatchCandidate, MediaInfo, Movie } from '@ottlib/shared';

interface MovieRow {
  id: number; canonical_path: string; folder_path: string; raw_filename: string; parsed_title: string; parsed_year: number | null;
  title_override: string | null; overview: string | null; poster_file: string | null; backdrop_file: string | null;
  genres_json: string; cast_json: string; rating: number | null; runtime: number | null; metadata_status: Movie['metadataStatus'];
  metadata_source: string | null; imdb_id: string | null; missing: number; added_at: string; watched: number;
  media_probe_status: string; container_format: string | null; duration_ms: number | null; video_width: number | null; video_height: number | null;
  video_codec: string | null; video_profile: string | null; video_bit_rate: number | null; hdr_format: string | null;
}

export interface ScannedMovie { folderId: number; path: string; filename: string; title: string; year: number | null; size: number; mtimeMs: number; seenAt: string }
export type ProbedMediaInfo = Omit<MediaInfo, 'tracks'>;
export interface PlaybackMovie { id: number; path: string; folderPath: string; filename: string; missing: boolean }
export interface MetadataTarget { id: number; title: string; year: number | null }
export interface MovieListQuery { search?: string; watched?: boolean; sort?: string; genre?: string; actor?: string; minRating?: number }
export interface MovieFilterOptions { genres: string[]; actors: string[] }

export class MovieRepository {
  public constructor(private readonly db: Database.Database) {}

  public list(deviceId?: string, query: MovieListQuery = {}): Movie[] {
    const clauses = ['m.missing = 0']; const values: unknown[] = [deviceId ?? ''];
    if (query.search?.trim()) {
      const search = query.search.trim().toLowerCase();
      const imdbId = search.match(/tt\d{5,}/)?.[0] ?? search;
      clauses.push('(LOWER(COALESCE(m.title_override, m.parsed_title)) LIKE ? OR LOWER(m.imdb_id) LIKE ?)');
      values.push(`%${search}%`, `%${imdbId}%`);
    }
    if (query.watched !== undefined) { clauses.push('COALESCE(ws.watched, 0) = ?'); values.push(Number(query.watched)); }
    if (query.genre) { clauses.push('EXISTS (SELECT 1 FROM json_each(m.genres_json) WHERE LOWER(value) LIKE ?)'); values.push(`%${query.genre.toLowerCase()}%`); }
    if (query.actor) { clauses.push('EXISTS (SELECT 1 FROM json_each(m.cast_json) WHERE LOWER(value) LIKE ?)'); values.push(`%${query.actor.toLowerCase()}%`); }
    if (query.minRating !== undefined) { clauses.push('m.rating >= ?'); values.push(query.minRating); }
    const sort = query.sort === 'year' ? 'm.parsed_year DESC, m.parsed_title COLLATE NOCASE' : query.sort === 'added' ? 'm.added_at DESC' : 'COALESCE(m.title_override, m.parsed_title) COLLATE NOCASE';
    const rows = this.db.prepare(`${this.selectSql()} WHERE ${clauses.join(' AND ')} ORDER BY ${sort}`).all(...values) as MovieRow[];
    return rows.map(this.map);
  }

  public listFilterOptions(): MovieFilterOptions {
    const rows = this.db.prepare("SELECT genres_json, cast_json FROM movies WHERE missing = 0 AND metadata_status = 'matched'").all() as Array<Pick<MovieRow, 'genres_json' | 'cast_json'>>;
    const uniqueSorted = (values: Iterable<string>) => [...new Set([...values].map((value) => value.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right));
    return {
      genres: uniqueSorted(rows.flatMap((row) => JSON.parse(row.genres_json) as string[])),
      actors: uniqueSorted(rows.flatMap((row) => JSON.parse(row.cast_json) as string[]))
    };
  }

  public get(id: number, deviceId?: string): Movie | undefined {
    const row = this.db.prepare(`${this.selectSql()} WHERE m.id = ?`).get(deviceId ?? '', id) as MovieRow | undefined;
    return row ? this.map(row) : undefined;
  }

  public listByIds(ids: number[], deviceId?: string): Movie[] {
    if (!ids.length) return [];
    const placeholders = ids.map(() => '?').join(', ');
    const rows = this.db.prepare(`${this.selectSql()} WHERE m.id IN (${placeholders})`).all(deviceId ?? '', ...ids) as MovieRow[];
    const byId = new Map(rows.map((row) => [row.id, this.map(row)]));
    return ids.flatMap((id) => {
      const movie = byId.get(id);
      return movie ? [movie] : [];
    });
  }

  public hasAll(ids: number[]): boolean {
    const uniqueIds = [...new Set(ids)];
    if (!uniqueIds.length) return true;
    const placeholders = uniqueIds.map(() => '?').join(', ');
    const row = this.db.prepare(`SELECT COUNT(*) AS count FROM movies WHERE id IN (${placeholders})`).get(...uniqueIds) as { count: number };
    return row.count === uniqueIds.length;
  }

  public playbackMovie(id: number): PlaybackMovie | undefined {
    const row = this.db.prepare('SELECT m.id, m.canonical_path, f.path AS folder_path, m.raw_filename, m.missing FROM movies m JOIN folders f ON f.id = m.folder_id WHERE m.id = ?').get(id) as any;
    return row && { id: row.id, path: row.canonical_path, folderPath: row.folder_path, filename: row.raw_filename, missing: Boolean(row.missing) };
  }

  public metadataTarget(id: number): MetadataTarget | undefined {
    const row = this.db.prepare('SELECT id, COALESCE(title_override, parsed_title) AS title, parsed_year FROM movies WHERE id = ?').get(id) as any;
    return row && { id: row.id, title: row.title, year: row.parsed_year };
  }

  public upsertScanned(movie: ScannedMovie): { id: number; needsMatch: boolean; needsProbe: boolean } {
    const existing = this.db.prepare('SELECT id, size, mtime_ms, metadata_status, media_probe_status FROM movies WHERE canonical_path = ?').get(movie.path) as any;
    const changed = !existing || existing.size !== movie.size || existing.mtime_ms !== movie.mtimeMs;
    this.db.prepare(`INSERT INTO movies (folder_id, canonical_path, raw_filename, parsed_title, parsed_year, size, mtime_ms, last_seen_at, metadata_status, missing)
      VALUES (@folderId, @path, @filename, @title, @year, @size, @mtimeMs, @seenAt, 'pending', 0)
      ON CONFLICT(canonical_path) DO UPDATE SET folder_id = excluded.folder_id, raw_filename = excluded.raw_filename,
      parsed_title = excluded.parsed_title, parsed_year = excluded.parsed_year, size = excluded.size, mtime_ms = excluded.mtime_ms,
      last_seen_at = excluded.last_seen_at, missing = 0,
      metadata_status = CASE WHEN movies.size <> excluded.size OR movies.mtime_ms <> excluded.mtime_ms THEN 'pending' ELSE movies.metadata_status END,
      media_probe_status = CASE WHEN movies.size <> excluded.size OR movies.mtime_ms <> excluded.mtime_ms THEN 'pending' ELSE movies.media_probe_status END`).run(movie);
    const row = this.db.prepare('SELECT id FROM movies WHERE canonical_path = ?').get(movie.path) as { id: number };
    return { id: row.id, needsMatch: changed || existing?.metadata_status === 'error', needsProbe: changed || existing?.media_probe_status === 'pending' };
  }

  public clearMediaInfo(id: number): void {
    this.db.prepare(`UPDATE movies SET media_probe_status = 'pending', media_probe_error = NULL, media_probed_at = NULL,
      container_format = NULL, duration_ms = NULL, video_width = NULL, video_height = NULL, video_codec = NULL,
      video_profile = NULL, video_bit_rate = NULL, hdr_format = NULL WHERE id = ?`).run(id);
  }

  public applyMediaInfo(id: number, mediaInfo: ProbedMediaInfo): void {
    this.db.prepare(`UPDATE movies SET media_probe_status = 'completed', media_probe_error = NULL, media_probed_at = CURRENT_TIMESTAMP,
      container_format = @container, duration_ms = @durationMs, video_width = @width, video_height = @height,
      video_codec = @videoCodec, video_profile = @videoProfile, video_bit_rate = @videoBitRate, hdr_format = @hdrFormat WHERE id = @id`).run({ ...mediaInfo, id });
  }

  public markMediaProbeFailed(id: number, error: string): void {
    this.db.prepare("UPDATE movies SET media_probe_status = 'failed', media_probe_error = ?, media_probed_at = CURRENT_TIMESTAMP WHERE id = ?").run(error.slice(0, 500), id);
  }

  public markMissingNotSeen(folderId: number, seenAt: string): void {
    this.db.prepare('UPDATE movies SET missing = 1 WHERE folder_id = ? AND last_seen_at < ?').run(folderId, seenAt);
  }

  public markFolderMissing(folderId: number): void { this.db.prepare('UPDATE movies SET missing = 1 WHERE folder_id = ?').run(folderId); }

  public updateTitleOverride(id: number, titleOverride: string | null): void {
    this.db.prepare('UPDATE movies SET title_override = ? WHERE id = ?').run(titleOverride, id);
  }

  public resetForRematch(id: number): void {
    this.db.prepare("UPDATE movies SET metadata_status = 'pending', metadata_error = NULL WHERE id = ?").run(id);
    this.clearCandidates(id);
  }

  public saveCandidates(movieId: number, candidates: Array<{ provider: string; providerId: string; title: string; year: number | null; score: number; mediaType: 'movie' | 'tv' }>): void {
    const insert = this.db.transaction((rows: typeof candidates) => {
      this.db.prepare('DELETE FROM movie_match_candidates WHERE movie_id = ?').run(movieId);
      const stmt = this.db.prepare('INSERT INTO movie_match_candidates (movie_id, provider, provider_id, title, year, score, media_type, rank) VALUES (@movieId, @provider, @providerId, @title, @year, @score, @mediaType, @rank)');
      rows.forEach((row, index) => stmt.run({ ...row, movieId, rank: index }));
      this.db.prepare("UPDATE movies SET metadata_status = 'suggested', metadata_error = NULL WHERE id = ?").run(movieId);
    });
    insert(candidates);
  }

  public getCandidates(movieId: number): MatchCandidate[] {
    const rows = this.db.prepare('SELECT id, provider, provider_id AS providerId, title, year, score, media_type AS mediaType FROM movie_match_candidates WHERE movie_id = ? ORDER BY rank').all(movieId) as MatchCandidate[];
    return rows;
  }

  public getCandidate(movieId: number, candidateId: number): { provider: string; providerId: string; mediaType: 'movie' | 'tv' } | undefined {
    const row = this.db.prepare('SELECT provider, provider_id AS providerId, media_type AS mediaType FROM movie_match_candidates WHERE movie_id = ? AND id = ?').get(movieId, candidateId) as any;
    return row;
  }

  public clearCandidates(movieId: number): void {
    this.db.prepare('DELETE FROM movie_match_candidates WHERE movie_id = ?').run(movieId);
  }

  public applyMetadata(id: number, metadata: { source: string; providerId: string; title: string; year: number | null; overview: string | null; posterFile: string | null; backdropFile: string | null; genres: string[]; cast: string[]; rating: number | null; runtime: number | null; imdbId: string | null }): void {
    this.db.prepare(`UPDATE movies SET metadata_status = 'matched', metadata_source = @source, provider_id = @providerId,
      parsed_title = @title, parsed_year = @year, overview = @overview, poster_file = @posterFile, backdrop_file = @backdropFile,
      genres_json = @genres, cast_json = @cast, rating = @rating, runtime = @runtime, imdb_id = @imdbId, matched_at = CURRENT_TIMESTAMP, metadata_error = NULL WHERE id = @id`).run({ ...metadata, id, genres: JSON.stringify(metadata.genres), cast: JSON.stringify(metadata.cast) });
    this.clearCandidates(id);
  }

  public markUnmatched(id: number, error: string | null = null): void {
    this.db.prepare("UPDATE movies SET metadata_status = ?, metadata_error = ? WHERE id = ?").run(error ? 'error' : 'unmatched', error, id);
    this.clearCandidates(id);
  }

  private selectSql(): string {
    return `SELECT m.*, f.path AS folder_path, COALESCE(ws.watched, 0) AS watched FROM movies m
      JOIN folders f ON f.id = m.folder_id LEFT JOIN movie_watch_state ws ON ws.movie_id = m.id AND ws.device_id = ?`;
  }

  private map = (row: MovieRow): Movie => ({
    id: row.id, title: row.title_override ?? row.parsed_title, year: row.parsed_year, rawFilename: row.raw_filename, filePath: row.canonical_path,
    titleOverride: row.title_override, overview: row.overview, posterUrl: row.poster_file ? `/media/posters/${encodeURIComponent(row.poster_file)}` : null,
    backdropUrl: row.backdrop_file ? `/media/backdrops/${encodeURIComponent(row.backdrop_file)}` : null,
    genres: JSON.parse(row.genres_json), cast: JSON.parse(row.cast_json), rating: row.rating, runtime: row.runtime,
    imdbId: row.imdb_id, metadataStatus: row.metadata_status, metadataSource: row.metadata_source,
    mediaInfo: row.media_probe_status === 'completed' ? {
      container: row.container_format, durationMs: row.duration_ms, width: row.video_width, height: row.video_height,
      videoCodec: row.video_codec, videoProfile: row.video_profile, videoBitRate: row.video_bit_rate, hdrFormat: row.hdr_format, tracks: []
    } : null,
    watched: Boolean(row.watched), missing: Boolean(row.missing), addedAt: row.added_at, shelves: []
  });
}
