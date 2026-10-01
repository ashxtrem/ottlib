import { stat } from 'node:fs/promises';
import { extname } from 'node:path';
import type { PlaybackSource } from '@ottlib/shared';
import { mimeTypes, subtitleMimeTypes } from '../config/defaults.js';
import { MovieRepository, type PlaybackMovie } from '../repositories/movieRepository.js';
import { isWithinRoot } from './scanner/walker.js';
import { findExternalSubtitleFiles, type ExternalSubtitleFile } from './scanner/externalSubtitleScanner.js';
import { LanPlaylist } from '../providers/playback/lanPlaylist.js';
import { LocalLaunch } from '../providers/playback/localLaunch.js';

export interface SubtitleFile { path: string; mimeType: string }

function subtitleMimeType(path: string): string | undefined { return subtitleMimeTypes[extname(path).slice(1).toLowerCase()]; }

export class PlaybackService {
  private readonly local = new LocalLaunch();
  private readonly playlist = new LanPlaylist();
  /** [streamQuery] adds the per-movie key external players need when an access PIN is set ('' otherwise). */
  public constructor(private readonly movies: MovieRepository, private readonly streamQuery: (id: number) => string = () => '') {}

  public async movieFile(id: number): Promise<PlaybackMovie> {
    const movie = this.movies.playbackMovie(id);
    if (!movie || movie.missing || !isWithinRoot(movie.folderPath, movie.path)) throw new Error('Movie file is unavailable');
    await stat(movie.path); return movie;
  }
  public async playLocal(id: number): Promise<void> { this.local.open(await this.movieFile(id)); }
  public async reveal(id: number): Promise<void> { this.local.reveal(await this.movieFile(id)); }
  public async playlistFor(id: number, origin: string): Promise<string> { return this.playlist.playlist(origin, await this.movieFile(id), this.streamQuery(id)); }

  /** What an embedded player should load. URLs are server-relative; the client resolves them against its server origin. */
  public async source(id: number, deviceId: string | undefined): Promise<PlaybackSource> {
    const file = await this.movieFile(id); const movie = this.movies.get(id, deviceId); const query = this.streamQuery(id);
    const subtitles = (await this.sideloadableSubtitles(file)).map(({ track }) => ({
      url: `/api/movies/${id}/subtitles/${track.order}${query}`, language: track.language, codec: track.codec, title: track.title, isForced: track.isForced, isHearingImpaired: track.isHearingImpaired
    }));
    return {
      kind: 'direct', streamUrl: `/api/stream/${id}${query}`, mimeType: mimeTypes[extname(file.filename).slice(1).toLowerCase()] ?? 'application/octet-stream',
      durationMs: movie?.mediaInfo?.durationMs ?? null, resumePositionMs: movie?.resumePositionMs ?? null, subtitles
    };
  }

  public async subtitleFile(id: number, order: number): Promise<SubtitleFile> {
    const file = (await this.sideloadableSubtitles(await this.movieFile(id))).find(({ track }) => track.order === order);
    if (!file) throw new Error('Subtitle file is unavailable');
    return { path: file.path, mimeType: subtitleMimeType(file.path)! };
  }

  private async sideloadableSubtitles(movie: PlaybackMovie): Promise<ExternalSubtitleFile[]> {
    return (await findExternalSubtitleFiles(movie.path)).filter((file) => subtitleMimeType(file.path) && isWithinRoot(movie.folderPath, file.path));
  }
}
