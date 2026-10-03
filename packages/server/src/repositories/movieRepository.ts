import type Database from 'better-sqlite3';
import { formatResolution, type MatchCandidate, type MediaInfo, type Movie, type MovieListItem, type MovieListPage } from '@ottlib/shared';

interface MovieRow {
  id: number; canonical_path: string; folder_path: string; raw_filename: string; parsed_title: string; parsed_year: number | null; metadata_title: string | null; metadata_year: number | null;
  title_override: string | null; overview: string | null; poster_file: string | null; backdrop_file: string | null;
  genres_json: string; cast_json: string; rating: number | null; runtime: number | null; metadata_status: Movie['metadataStatus'];
  metadata_source: string | null; imdb_id: string | null; missing: number; added_at: string; watched: number; resume_position_ms: number | null;
  metadata_media_type: 'movie' | 'tv' | null; season: number | null; episode: number | null; size: number;
  media_probe_status: string; container_format: string | null; duration_ms: number | null; video_width: number | null; video_height: number | null;
  video_codec: string | null; video_profile: string | null; video_bit_rate: number | null; hdr_format: string | null;
}

interface MovieListItemRow {
  id: number; parsed_title: string; parsed_year: number | null; metadata_title: string | null; metadata_year: number | null; title_override: string | null; poster_file: string | null;
  metadata_status: Movie['metadataStatus']; watched: number; missing: number; added_at: string; video_height: number | null; hdr_format: string | null;
  resume_position_ms: number | null; duration_ms: number | null; metadata_media_type: string | null;
}

export interface ScannedMovie { folderId: number; path: string; filename: string; title: string; year: number | null; size: number; mtimeMs: number; seenAt: string }
export type ProbedMediaInfo = Omit<MediaInfo, 'tracks'>;
export interface PlaybackMovie { id: number; path: string; folderPath: string; filename: string; missing: boolean }
export interface TorrentMovieMatch { id: number; missing: boolean }
export interface MetadataTarget { id: number; title: string; year: number | null; rawFilename: string; metadataSource: string | null; providerId: string | null; mediaType: 'movie' | 'tv' | null; imdbId: string | null }
export interface MovieListQuery { search?: string; watched?: boolean; availability?: 'available' | 'unavailable'; mediaType?: 'movie' | 'tv'; sort?: string; genre?: string; actor?: string; quality?: string; audioLanguage?: string; minRating?: number; needsReview?: boolean; cursor?: string; limit?: number }
export interface MovieFilterOptions { genres: string[]; actors: string[]; resolutions: string[]; audioLanguages: string[] }

type MovieSort = 'title' | 'year' | 'added' | 'quality';
type MovieListCursor =
  | { sort: 'title'; title: string; id: number }
  | { sort: 'year'; year: number | null; title: string; id: number }
  | { sort: 'added'; addedAt: string; id: number }
  | { sort: 'quality'; height: number | null; title: string; id: number };

export class MovieRepository {
  public constructor(private readonly db: Database.Database) {}

  public list(deviceId?: string, query: MovieListQuery = {}): Movie[] {
    const { clauses, values } = this.filters(query);
    const sort = this.sort(query.sort).orderBy;
    const rows = this.db.prepare(`${this.selectSql()} WHERE ${clauses.join(' AND ')} ORDER BY ${sort}`).all(deviceId ?? '', ...values) as MovieRow[];
    return rows.map(this.map);
  }

  public listSummaries(deviceId: string | undefined, query: MovieListQuery = {}): MovieListPage {
    const sort = this.sort(query.sort); const cursor = this.decodeCursor(query.cursor, sort.name); const filters = this.filters(query); const clauses = [...filters.clauses]; const values = [...filters.values];
    if (cursor) this.addCursorClause(clauses, values, cursor);
    const limit = Math.min(Math.max(Math.floor(query.limit ?? 48), 1), 100);
    const rows = this.db.prepare(`${this.summarySelectSql()} WHERE ${clauses.join(' AND ')} ORDER BY ${sort.orderBy} LIMIT ?`).all(deviceId ?? '', ...values, limit + 1) as MovieListItemRow[];
    const items = rows.slice(0, limit).map(this.mapListItem);
    const total = (this.db.prepare(`SELECT COUNT(*) AS count FROM movies m LEFT JOIN movie_watch_state ws ON ws.movie_id = m.id AND ws.device_id = ? WHERE ${filters.clauses.join(' AND ')}`).get(deviceId ?? '', ...filters.values) as { count: number }).count;
    return { items, nextCursor: rows.length > limit ? this.encodeCursor(sort.name, rows[limit - 1]) : null, total };
  }

  public listFilterOptions(): MovieFilterOptions {
    const rows = this.db.prepare("SELECT genres_json, cast_json FROM movies WHERE missing = 0 AND metadata_status = 'matched'").all() as Array<Pick<MovieRow, 'genres_json' | 'cast_json'>>;
    const mediaRows = this.db.prepare("SELECT video_height FROM movies WHERE missing = 0 AND media_probe_status = 'completed' AND video_height IS NOT NULL").all() as Array<Pick<MovieRow, 'video_height'>>;
    const trackRows = this.db.prepare(`SELECT DISTINCT mt.language FROM media_tracks mt
      JOIN movies m ON m.id = mt.movie_id WHERE m.missing = 0 AND mt.track_type = 'audio' AND mt.language IS NOT NULL`).all() as Array<{ language: string }>;
    const uniqueSorted = (values: Iterable<string>) => [...new Set([...values].map((value) => value.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right));
    return {
      genres: uniqueSorted(rows.flatMap((row) => JSON.parse(row.genres_json) as string[])),
      actors: uniqueSorted(rows.flatMap((row) => JSON.parse(row.cast_json) as string[])),
      resolutions: uniqueSorted(mediaRows.flatMap((row) => formatResolution(row.video_height) ?? [])).sort((left, right) => this.resolutionRank(right) - this.resolutionRank(left)),
      audioLanguages: uniqueSorted(trackRows.map((row) => row.language))
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

  public listContinueWatching(deviceId: string, limit: number): MovieListItem[] {
    const rows = this.db.prepare(`${this.summarySelectSql()} WHERE pp.movie_id IS NOT NULL AND m.missing = 0 ORDER BY pp.updated_at DESC, m.id DESC LIMIT ?`).all(deviceId, limit) as MovieListItemRow[];
    return rows.map(this.mapListItem);
  }

  public nextEpisodeId(id: number): number | undefined {
    const row = this.db.prepare(`SELECT n.id FROM movies c JOIN movies n ON
      n.metadata_media_type = 'tv' AND n.missing = 0 AND n.season > 0 AND n.episode > 0
      AND ((c.metadata_source IS NOT NULL AND c.provider_id IS NOT NULL AND n.metadata_source = c.metadata_source AND n.provider_id = c.provider_id)
        OR (c.imdb_id IS NOT NULL AND n.imdb_id = c.imdb_id))
      WHERE c.id = ? AND c.metadata_media_type = 'tv' AND c.season > 0 AND c.episode > 0
      AND (n.season > c.season OR (n.season = c.season AND n.episode > c.episode))
      ORDER BY n.season, n.episode, n.id LIMIT 1`).get(id) as { id: number } | undefined;
    return row?.id;
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

  public findForTorrentMatch(title: string, year: number | null): TorrentMovieMatch | undefined {
    const sql = year === null
      ? `SELECT id, missing FROM movies WHERE LOWER(TRIM(COALESCE(title_override, metadata_title, parsed_title))) = LOWER(TRIM(?)) ORDER BY missing ASC, id ASC LIMIT 1`
      : `SELECT id, missing FROM movies WHERE LOWER(TRIM(COALESCE(title_override, metadata_title, parsed_title))) = LOWER(TRIM(?) ) AND COALESCE(metadata_year, parsed_year) = ? ORDER BY missing ASC, id ASC LIMIT 1`;
    const row = this.db.prepare(sql).get(...(year === null ? [title] : [title, year])) as TorrentMovieMatch | undefined;
    return row ? { ...row, missing: Boolean(row.missing) } : undefined;
  }

  public findDuplicateIds(id: number): number[] {
    const anchor = this.db.prepare(`SELECT imdb_id, metadata_media_type, season, episode,
      COALESCE(title_override, metadata_title, parsed_title) AS title, COALESCE(metadata_year, parsed_year) AS year
      FROM movies WHERE id = ?`).get(id) as { imdb_id: string | null; metadata_media_type: 'movie' | 'tv' | null; season: number | null; episode: number | null; title: string; year: number | null } | undefined;
    if (!anchor) return [];

    if (anchor.imdb_id?.trim()) {
      const episodeClause = anchor.metadata_media_type === 'tv' && anchor.season !== null && anchor.episode !== null
        ? ' AND season = ? AND episode = ?' : '';
      const rows = this.db.prepare(`SELECT id FROM movies WHERE imdb_id = ? AND missing = 0 AND id != ?${episodeClause} ORDER BY id`).all(
        anchor.imdb_id, id, ...(episodeClause ? [anchor.season, anchor.episode] : [])
      ) as Array<{ id: number }>;
      return rows.map((row) => row.id);
    }

    const yearClause = anchor.year === null ? ' AND COALESCE(metadata_year, parsed_year) IS NULL' : ' AND COALESCE(metadata_year, parsed_year) = ?';
    const rows = this.db.prepare(`SELECT id FROM movies WHERE LOWER(TRIM(COALESCE(title_override, metadata_title, parsed_title))) = LOWER(TRIM(?))${yearClause}
      AND missing = 0 AND id != ? ORDER BY id`).all(anchor.title, ...(anchor.year === null ? [] : [anchor.year]), id) as Array<{ id: number }>;
    return rows.map((row) => row.id);
  }

  public metadataTarget(id: number): MetadataTarget | undefined {
    const row = this.db.prepare('SELECT id, COALESCE(title_override, parsed_title) AS title, parsed_year, raw_filename, metadata_source, provider_id, metadata_media_type, imdb_id FROM movies WHERE id = ?').get(id) as any;
    return row && { id: row.id, title: row.title, year: row.parsed_year, rawFilename: row.raw_filename, metadataSource: row.metadata_source, providerId: row.provider_id, mediaType: row.metadata_media_type, imdbId: row.imdb_id };
  }

  public listSuggestedMetadataTargets(): MetadataTarget[] {
    const rows = this.db.prepare("SELECT id, COALESCE(title_override, parsed_title) AS title, parsed_year, raw_filename, metadata_source, provider_id, metadata_media_type, imdb_id FROM movies WHERE metadata_status = 'suggested'").all() as any[];
    return rows.map((row) => ({ id: row.id, title: row.title, year: row.parsed_year, rawFilename: row.raw_filename, metadataSource: row.metadata_source, providerId: row.provider_id, mediaType: row.metadata_media_type, imdbId: row.imdb_id }));
  }

  public countSuggestedMetadataTargets(): number {
    return (this.db.prepare("SELECT COUNT(*) AS count FROM movies WHERE metadata_status = 'suggested'").get() as { count: number }).count;
  }

  public listMetadataRefreshTargets(ids?: number[]): MetadataTarget[] {
    const idClause = ids?.length ? ` AND id IN (${ids.map(() => '?').join(', ')})` : '';
    const rows = this.db.prepare(`SELECT id, COALESCE(title_override, parsed_title) AS title, parsed_year, raw_filename, metadata_source, provider_id, metadata_media_type, imdb_id FROM movies WHERE missing = 0${idClause}`).all(...(ids ?? [])) as any[];
    return rows.map((row) => ({ id: row.id, title: row.title, year: row.parsed_year, rawFilename: row.raw_filename, metadataSource: row.metadata_source, providerId: row.provider_id, mediaType: row.metadata_media_type, imdbId: row.imdb_id }));
  }

  public listMatchedWithoutMediaType(): MetadataTarget[] {
    const rows = this.db.prepare(`SELECT id, COALESCE(title_override, parsed_title) AS title, parsed_year, raw_filename, metadata_source, provider_id, metadata_media_type, imdb_id FROM movies
      WHERE missing = 0 AND metadata_status = 'matched' AND metadata_media_type IS NULL
      AND (imdb_id IS NOT NULL OR (metadata_source IS NOT NULL AND provider_id IS NOT NULL))`).all() as any[];
    return rows.map((row) => ({ id: row.id, title: row.title, year: row.parsed_year, rawFilename: row.raw_filename, metadataSource: row.metadata_source, providerId: row.provider_id, mediaType: row.metadata_media_type, imdbId: row.imdb_id }));
  }

  public setMetadataMediaType(id: number, mediaType: 'movie' | 'tv'): void {
    this.db.prepare('UPDATE movies SET metadata_media_type = ? WHERE id = ?').run(mediaType, id);
  }

  public upsertScanned(movie: ScannedMovie): { id: number; inserted: boolean; needsMatch: boolean; needsProbe: boolean } {
    return this.db.transaction(() => {
      const existing = this.db.prepare('SELECT id, size, mtime_ms, metadata_status, media_probe_status FROM movies WHERE canonical_path = ?').get(movie.path) as any;
      const changed = !existing || existing.size !== movie.size || existing.mtime_ms !== movie.mtimeMs;
      this.db.prepare(`INSERT INTO movies (folder_id, canonical_path, raw_filename, parsed_title, parsed_year, size, mtime_ms, last_seen_at, metadata_status, missing)
        VALUES (@folderId, @path, @filename, @title, @year, @size, @mtimeMs, @seenAt, 'pending', 0)
        ON CONFLICT(canonical_path) DO UPDATE SET folder_id = excluded.folder_id, raw_filename = excluded.raw_filename,
        parsed_title = excluded.parsed_title, parsed_year = excluded.parsed_year,
        size = excluded.size, mtime_ms = excluded.mtime_ms,
        last_seen_at = excluded.last_seen_at, missing = 0,
        media_probe_status = CASE WHEN movies.size <> excluded.size OR movies.mtime_ms <> excluded.mtime_ms THEN 'pending' ELSE movies.media_probe_status END`).run(movie);
      const row = this.db.prepare('SELECT id FROM movies WHERE canonical_path = ?').get(movie.path) as { id: number };
      if (existing && changed) this.resetForRematch(row.id);
      return { id: row.id, inserted: !existing, needsMatch: changed || existing?.metadata_status === 'error', needsProbe: changed || existing?.media_probe_status === 'pending' };
    })();
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
    this.db.transaction(() => {
      this.clearAutomaticMetadata(id, 'pending');
      this.clearCandidates(id);
    })();
  }

  public saveCandidates(movieId: number, candidates: Array<{ provider: string; providerId: string; title: string; year: number | null; score: number; mediaType: 'movie' | 'tv'; season?: number; episode?: number }>): void {
    const insert = this.db.transaction((rows: typeof candidates) => {
      this.db.prepare('DELETE FROM movie_match_candidates WHERE movie_id = ?').run(movieId);
      const stmt = this.db.prepare('INSERT INTO movie_match_candidates (movie_id, provider, provider_id, title, year, score, media_type, season, episode, rank) VALUES (@movieId, @provider, @providerId, @title, @year, @score, @mediaType, @season, @episode, @rank)');
      rows.forEach((row, index) => stmt.run({ ...row, season: row.season ?? null, episode: row.episode ?? null, movieId, rank: index }));
      const topMatch = rows[0];
      this.db.prepare(`UPDATE movies SET
        metadata_title = CASE WHEN provider_id IS NOT NULL THEN metadata_title ELSE ? END,
        metadata_year = CASE WHEN provider_id IS NOT NULL THEN metadata_year ELSE ? END,
        metadata_status = 'suggested', metadata_error = NULL WHERE id = ?`).run(topMatch.title, topMatch.year, movieId);
    });
    insert(candidates);
  }

  public getCandidates(movieId: number): MatchCandidate[] {
    const rows = this.db.prepare('SELECT id, provider, provider_id AS providerId, title, year, score, media_type AS mediaType, season, episode FROM movie_match_candidates WHERE movie_id = ? ORDER BY rank').all(movieId) as MatchCandidate[];
    return rows.map((row) => ({ ...row, season: row.season ?? undefined, episode: row.episode ?? undefined }));
  }

  public getCandidate(movieId: number, candidateId: number): { provider: string; providerId: string; mediaType: 'movie' | 'tv'; season?: number; episode?: number } | undefined {
    const row = this.db.prepare('SELECT provider, provider_id AS providerId, media_type AS mediaType, season, episode FROM movie_match_candidates WHERE movie_id = ? AND id = ?').get(movieId, candidateId) as any;
    return row && { ...row, season: row.season ?? undefined, episode: row.episode ?? undefined };
  }

  public clearCandidates(movieId: number): void {
    this.db.prepare('DELETE FROM movie_match_candidates WHERE movie_id = ?').run(movieId);
  }

  public dismissCandidates(movieId: number): void {
    const dismiss = this.db.transaction(() => {
      this.db.prepare(`UPDATE movies SET
        metadata_status = CASE WHEN provider_id IS NOT NULL THEN 'matched' ELSE 'unmatched' END,
        metadata_title = CASE WHEN provider_id IS NOT NULL THEN metadata_title ELSE NULL END,
        metadata_year = CASE WHEN provider_id IS NOT NULL THEN metadata_year ELSE NULL END,
        metadata_error = NULL WHERE id = ?`).run(movieId);
      this.clearCandidates(movieId);
    });
    dismiss();
  }

  public applyMetadata(id: number, metadata: { source: string; providerId: string; mediaType?: 'movie' | 'tv'; season?: number | null; episode?: number | null; title: string; year: number | null; overview: string | null; posterFile: string | null; backdropFile: string | null; genres: string[]; cast: string[]; rating: number | null; runtime: number | null; imdbId: string | null }): void {
    const apply = this.db.transaction((values: Omit<typeof metadata, 'mediaType'> & { mediaType: 'movie' | 'tv' | null; id: number }) => {
      this.db.prepare(`UPDATE movies SET metadata_status = 'matched', metadata_source = @source, provider_id = @providerId,
      metadata_media_type = COALESCE(@mediaType, metadata_media_type), season = @season, episode = @episode, metadata_title = @title, metadata_year = @year, overview = @overview, poster_file = @posterFile, backdrop_file = @backdropFile,
      genres_json = @genres, cast_json = @cast, rating = @rating, runtime = @runtime, imdb_id = @imdbId, matched_at = CURRENT_TIMESTAMP, metadata_error = NULL WHERE id = @id`).run({ ...values, genres: JSON.stringify(values.genres), cast: JSON.stringify(values.cast) });
      this.db.prepare('DELETE FROM movie_match_candidates WHERE movie_id = ?').run(values.id);
    });
    apply({ ...metadata, mediaType: metadata.mediaType ?? null, season: metadata.season ?? null, episode: metadata.episode ?? null, id });
  }

  public markUnmatched(id: number, error: string | null = null): void {
    this.db.transaction(() => {
      if (error) this.db.prepare("UPDATE movies SET metadata_status = 'error', metadata_error = ? WHERE id = ?").run(error, id);
      else this.clearAutomaticMetadata(id, 'unmatched');
      this.clearCandidates(id);
    })();
  }

  private clearAutomaticMetadata(id: number, status: 'pending' | 'unmatched'): void {
    this.db.prepare(`UPDATE movies SET metadata_status = ?, metadata_error = NULL,
      metadata_title = NULL, metadata_year = NULL, metadata_source = NULL, provider_id = NULL,
      imdb_id = NULL, metadata_media_type = NULL, season = NULL, episode = NULL, matched_at = NULL,
      overview = NULL, poster_file = NULL, backdrop_file = NULL, genres_json = '[]', cast_json = '[]',
      rating = NULL, runtime = NULL WHERE id = ?`).run(status, id);
  }

  private selectSql(): string {
    return `SELECT m.*, f.path AS folder_path, COALESCE(ws.watched, 0) AS watched, pp.position_ms AS resume_position_ms FROM ${this.deviceScopedJoins()}
      JOIN folders f ON f.id = m.folder_id`;
  }

  private summarySelectSql(): string {
    return `SELECT m.id, m.parsed_title, m.parsed_year, m.metadata_title, m.metadata_year, m.title_override, m.poster_file, m.metadata_status, m.added_at,
      m.missing, m.metadata_media_type, m.video_height, m.hdr_format, m.duration_ms, COALESCE(ws.watched, 0) AS watched, pp.position_ms AS resume_position_ms FROM ${this.deviceScopedJoins()}`;
  }

  /** Binds the device id once (first `?`) and exposes it to both per-device joins. */
  private deviceScopedJoins(): string {
    return `(SELECT ? AS device_id) device CROSS JOIN movies m
      LEFT JOIN movie_watch_state ws ON ws.movie_id = m.id AND ws.device_id = device.device_id
      LEFT JOIN playback_progress pp ON pp.movie_id = m.id AND pp.device_id = device.device_id`;
  }

  private filters(query: MovieListQuery): { clauses: string[]; values: unknown[] } {
    const clauses = ['1 = 1']; const values: unknown[] = [];
    if (query.availability) { clauses.push('m.missing = ?'); values.push(Number(query.availability === 'unavailable')); }
    if (query.mediaType) { clauses.push('m.metadata_media_type = ?'); values.push(query.mediaType); }
    if (query.search?.trim()) {
      const search = query.search.trim().toLowerCase(); const imdbId = search.match(/tt\d{5,}/)?.[0] ?? search;
      clauses.push('(LOWER(COALESCE(m.title_override, m.metadata_title, m.parsed_title)) LIKE ? OR LOWER(m.imdb_id) LIKE ?)'); values.push(`%${search}%`, `%${imdbId}%`);
    }
    if (query.watched !== undefined) { clauses.push('COALESCE(ws.watched, 0) = ?'); values.push(Number(query.watched)); }
    if (query.genre) { clauses.push('EXISTS (SELECT 1 FROM json_each(m.genres_json) WHERE LOWER(value) LIKE ?)'); values.push(`%${query.genre.toLowerCase()}%`); }
    if (query.actor) { clauses.push('EXISTS (SELECT 1 FROM json_each(m.cast_json) WHERE LOWER(value) LIKE ?)'); values.push(`%${query.actor.toLowerCase()}%`); }
    if (query.quality?.trim()) this.addQualityClause(clauses, values, query.quality.trim());
    if (query.audioLanguage?.trim()) { clauses.push("EXISTS (SELECT 1 FROM media_tracks mt WHERE mt.movie_id = m.id AND mt.track_type = 'audio' AND LOWER(COALESCE(mt.language, '')) = ?)"); values.push(query.audioLanguage.trim().toLowerCase()); }
    if (query.minRating !== undefined) { clauses.push('m.rating >= ?'); values.push(query.minRating); }
    if (query.needsReview) clauses.push("m.metadata_status = 'suggested'");
    return { clauses, values };
  }

  private sort(value: string | undefined): { name: MovieSort; orderBy: string } {
    if (value === 'year') return { name: 'year', orderBy: 'COALESCE(m.metadata_year, m.parsed_year) DESC, COALESCE(m.title_override, m.metadata_title, m.parsed_title) COLLATE NOCASE ASC, m.id ASC' };
    if (value === 'added') return { name: 'added', orderBy: 'm.added_at DESC, m.id DESC' };
    if (value === 'quality') return { name: 'quality', orderBy: 'm.video_height DESC, COALESCE(m.title_override, m.metadata_title, m.parsed_title) COLLATE NOCASE ASC, m.id ASC' };
    return { name: 'title', orderBy: 'COALESCE(m.title_override, m.metadata_title, m.parsed_title) COLLATE NOCASE ASC, m.id ASC' };
  }

  private addQualityClause(clauses: string[], values: unknown[], quality: string): void {
    const minimumHeight = quality === '4K' ? 2160 : quality === '1440p' ? 1440 : quality === '1080p' ? 1080 : quality === '720p' ? 720 : undefined;
    if (minimumHeight !== undefined) {
      const maximumHeight = quality === '4K' ? undefined : quality === '1440p' ? 2160 : quality === '1080p' ? 1440 : 1080;
      clauses.push(maximumHeight === undefined ? 'm.video_height >= ?' : 'm.video_height >= ? AND m.video_height < ?'); values.push(minimumHeight, ...(maximumHeight === undefined ? [] : [maximumHeight]));
      return;
    }
    const exactHeight = /^([1-9]\d{0,4})p$/.exec(quality)?.[1];
    if (exactHeight) { clauses.push('m.video_height = ?'); values.push(Number(exactHeight)); return; }
    clauses.push('1 = 0');
  }

  private resolutionRank(value: string): number {
    if (value === '4K') return 2160;
    return Number.parseInt(value, 10) || 0;
  }

  private addCursorClause(clauses: string[], values: unknown[], cursor: MovieListCursor): void {
    const title = 'COALESCE(m.title_override, m.metadata_title, m.parsed_title)';
    const year = 'COALESCE(m.metadata_year, m.parsed_year)';
    if (cursor.sort === 'title') {
      clauses.push(`(${title} COLLATE NOCASE > ? COLLATE NOCASE OR (${title} COLLATE NOCASE = ? COLLATE NOCASE AND m.id > ?))`);
      values.push(cursor.title, cursor.title, cursor.id); return;
    }
    if (cursor.sort === 'added') {
      clauses.push('(m.added_at < ? OR (m.added_at = ? AND m.id < ?))'); values.push(cursor.addedAt, cursor.addedAt, cursor.id); return;
    }
    if (cursor.sort === 'quality') {
      if (cursor.height === null) {
        clauses.push(`m.video_height IS NULL AND (${title} COLLATE NOCASE > ? COLLATE NOCASE OR (${title} COLLATE NOCASE = ? COLLATE NOCASE AND m.id > ?))`);
        values.push(cursor.title, cursor.title, cursor.id); return;
      }
      clauses.push(`(m.video_height IS NULL OR m.video_height < ? OR (m.video_height = ? AND (${title} COLLATE NOCASE > ? COLLATE NOCASE OR (${title} COLLATE NOCASE = ? COLLATE NOCASE AND m.id > ?))))`);
      values.push(cursor.height, cursor.height, cursor.title, cursor.title, cursor.id); return;
    }
    if (cursor.year === null) {
      clauses.push(`${year} IS NULL AND (${title} COLLATE NOCASE > ? COLLATE NOCASE OR (${title} COLLATE NOCASE = ? COLLATE NOCASE AND m.id > ?))`);
      values.push(cursor.title, cursor.title, cursor.id); return;
    }
    clauses.push(`(${year} IS NULL OR ${year} < ? OR (${year} = ? AND (${title} COLLATE NOCASE > ? COLLATE NOCASE OR (${title} COLLATE NOCASE = ? COLLATE NOCASE AND m.id > ?))))`);
    values.push(cursor.year, cursor.year, cursor.title, cursor.title, cursor.id);
  }

  private decodeCursor(value: string | undefined, sort: MovieSort): MovieListCursor | undefined {
    if (!value) return undefined;
    try {
      const cursor = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as MovieListCursor;
      if (cursor.sort !== sort || !Number.isInteger(cursor.id)) throw new Error();
      if (cursor.sort === 'title' && typeof cursor.title === 'string') return cursor;
      if (cursor.sort === 'year' && (typeof cursor.year === 'number' || cursor.year === null) && typeof cursor.title === 'string') return cursor;
      if (cursor.sort === 'added' && typeof cursor.addedAt === 'string') return cursor;
      if (cursor.sort === 'quality' && (typeof cursor.height === 'number' || cursor.height === null) && typeof cursor.title === 'string') return cursor;
    } catch { /* handled below */ }
    throw new Error('Invalid movie-list cursor');
  }

  private encodeCursor(sort: MovieSort, row: MovieListItemRow): string {
    const title = row.title_override ?? row.metadata_title ?? row.parsed_title;
    const cursor: MovieListCursor = sort === 'title' ? { sort, title, id: row.id } : sort === 'year' ? { sort, year: row.metadata_year ?? row.parsed_year, title, id: row.id } : sort === 'added' ? { sort, addedAt: row.added_at, id: row.id } : { sort, height: row.video_height, title, id: row.id };
    return Buffer.from(JSON.stringify(cursor)).toString('base64url');
  }

  private map = (row: MovieRow): Movie => ({
    id: row.id, title: row.title_override ?? row.metadata_title ?? row.parsed_title, year: row.metadata_year ?? row.parsed_year, rawFilename: row.raw_filename, filePath: row.canonical_path,
    titleOverride: row.title_override, overview: row.overview, posterUrl: row.poster_file ? `/media/posters/${encodeURIComponent(row.poster_file)}` : null,
    backdropUrl: row.backdrop_file ? `/media/backdrops/${encodeURIComponent(row.backdrop_file)}` : null,
    genres: JSON.parse(row.genres_json), cast: JSON.parse(row.cast_json), rating: row.rating, runtime: row.runtime,
    imdbId: row.imdb_id, metadataStatus: row.metadata_status, metadataSource: row.metadata_source, mediaType: row.metadata_media_type, season: row.season, episode: row.episode, fileSizeBytes: row.size,
    mediaInfo: row.media_probe_status === 'completed' ? {
      container: row.container_format, durationMs: row.duration_ms, width: row.video_width, height: row.video_height,
      videoCodec: row.video_codec, videoProfile: row.video_profile, videoBitRate: row.video_bit_rate, hdrFormat: row.hdr_format, tracks: []
    } : null,
    watched: Boolean(row.watched), resumePositionMs: row.resume_position_ms, missing: Boolean(row.missing), addedAt: row.added_at, shelves: []
  });

  private mapListItem = (row: MovieListItemRow): MovieListItem => ({
    nextUp: row.resume_position_ms === 0 ? (row.metadata_media_type === 'tv' ? 'episode' : 'collection') : null,
    id: row.id, title: row.title_override ?? row.metadata_title ?? row.parsed_title, year: row.metadata_year ?? row.parsed_year,
    posterUrl: row.poster_file ? `/media/posters/${encodeURIComponent(row.poster_file)}` : null,
    resolution: formatResolution(row.video_height), hdrFormat: row.hdr_format,
    watched: Boolean(row.watched), resumePositionMs: row.resume_position_ms, durationMs: row.duration_ms,
    missing: Boolean(row.missing), metadataStatus: row.metadata_status, shelves: []
  });
}
