import { stat } from 'node:fs/promises';
import { extname } from 'node:path';
import type { PlaybackRequest, PlaybackSource } from '@ottlib/shared';
import { mimeTypes, subtitleMimeTypes } from '../config/defaults.js';
import { MovieRepository, type PlaybackMovie } from '../repositories/movieRepository.js';
import { isWithinRoot } from './scanner/walker.js';
import { findExternalSubtitleFiles, type ExternalSubtitleFile } from './scanner/externalSubtitleScanner.js';
import { LanPlaylist } from '../providers/playback/lanPlaylist.js';
import { LocalLaunch } from '../providers/playback/localLaunch.js';
import type { LocalPlaybackHandoff } from '../providers/playback/PlaybackHandoff.js';
import { SubtitleLibraryService, downloadedSubtitleOrder } from './subtitles/subtitleLibraryService.js';
import type { PlaybackPlanner } from './playbackPlanner.js';

export interface SubtitleFile { path: string; mimeType: string }

function subtitleMimeType(path: string): string | undefined { return subtitleMimeTypes[extname(path).slice(1).toLowerCase()]; }

export class PlaybackService {
  private readonly playlist = new LanPlaylist();
  /** [streamQuery] adds the per-movie key external players need when an access PIN is set ('' otherwise). */
  public constructor(private readonly movies: MovieRepository, private readonly streamQuery: (id: number) => string = () => '', private readonly subtitleLibrary?: SubtitleLibraryService, private readonly local: LocalPlaybackHandoff = new LocalLaunch(), private readonly planner?: PlaybackPlanner) {}

  public async movieFile(id: number): Promise<PlaybackMovie> {
    const movie = this.movies.playbackMovie(id);
    if (!movie || movie.missing || !isWithinRoot(movie.folderPath, movie.path)) throw new Error('Movie file is unavailable');
    await stat(movie.path); return movie;
  }
  public hasVlc(): boolean { return this.local.hasVlc(); }
  public async playLocal(id: number, startSec = 0): Promise<void> { this.local.open(await this.movieFile(id), startSec); }
  public async reveal(id: number): Promise<void> { this.local.reveal(await this.movieFile(id)); }
  public async playlistFor(id: number, origin: string, startSec = 0): Promise<string> { return this.playlist.playlist(origin, await this.movieFile(id), this.streamQuery(id), startSec); }

  /** What an embedded player should load. URLs are server-relative; the client resolves them against its server origin. */
  public async source(id: number, profileId: number | undefined, request?: PlaybackRequest, deviceId?: string): Promise<PlaybackSource> {
    const file = await this.movieFile(id); const query = this.streamQuery(id);
    // Planned first: it may probe the file, and the duration below comes from that probe.
    // Without a planner nothing can be transcoded, so the file plays as it is.
    const plan = !request ? undefined : this.planner ? await this.planner.plan(file, profileId, request, deviceId) : { mode: 'direct' as const, reasons: ['ffmpeg-missing'], audioTracks: [], burnInSubtitles: [] };
    const movie = this.movies.get(id, profileId);
    const downloaded = await this.subtitleLibrary?.list(id) ?? [];
    const subtitles = (await this.sideloadableSubtitles(file)).filter(subtitle => !downloaded.some(record => record.sidecar_path === subtitle.path)).map(({ track }) => ({
      url: `/api/movies/${id}/subtitles/${track.order}${query}`, language: track.language, codec: track.codec, title: track.title, isForced: track.isForced, isHearingImpaired: track.isHearingImpaired
    }));
    const direct: PlaybackSource = {
      kind: 'direct', streamUrl: `/api/stream/${id}${query}`, mimeType: mimeTypes[extname(file.filename).slice(1).toLowerCase()] ?? 'application/octet-stream',
      durationMs: movie?.mediaInfo?.durationMs ?? null, resumePositionMs: movie?.resumePositionMs ?? null, subtitles: [...subtitles, ...downloaded.map(record => this.subtitleLibrary!.source(record))]
    };
    if (!plan) return direct;
    const { hls, ...details } = plan;
    return { ...direct, ...(hls ? { kind: 'hls' as const, streamUrl: hls.playlistUrl, mimeType: 'application/vnd.apple.mpegurl', sessionUrl: hls.sessionUrl } : {}), ...details };
  }

  public async subtitleFile(id: number, order: number): Promise<SubtitleFile> {
    if (order >= downloadedSubtitleOrder && this.subtitleLibrary) { await this.movieFile(id); return this.subtitleLibrary.file(id, order); }
    const file = (await this.sideloadableSubtitles(await this.movieFile(id))).find(({ track }) => track.order === order);
    if (!file) throw new Error('Subtitle file is unavailable');
    return { path: file.path, mimeType: subtitleMimeType(file.path)! };
  }

  private async sideloadableSubtitles(movie: PlaybackMovie): Promise<ExternalSubtitleFile[]> {
    return (await findExternalSubtitleFiles(movie.path)).filter((file) => subtitleMimeType(file.path) && isWithinRoot(movie.folderPath, file.path));
  }
}
