import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { MediaTrack } from '@ottlib/shared';
import { embeddedSubtitleDirName, embeddedSubtitleExtractTimeoutMs, embeddedSubtitleFailureMemoryMs, embeddedTextSubtitleCodecs } from '../config/transcode.js';
import type { FfmpegBinary } from '../providers/transcode/ffmpegLocator.js';
import { MediaTrackRepository } from '../repositories/mediaTrackRepository.js';
import type { PlaybackMovie } from '../repositories/movieRepository.js';

/** Why a WebVTT track cannot be served: 404 not a text track of the movie, 422 extraction failed, 503 no ffmpeg. */
export class EmbeddedSubtitleError extends Error {
  public constructor(message: string, public readonly status: 404 | 422 | 503) { super(message); }
}

export type EmbeddedVtt = { state: 'ready'; path: string; size: number } | { state: 'extracting' };

export function isTextSubtitle(track: MediaTrack): boolean {
  return track.type === 'subtitle' && track.source === 'embedded' && embeddedTextSubtitleCodecs.has(track.codec?.toLowerCase() ?? '');
}

/**
 * Extracts a movie's embedded text subtitle tracks (SRT, ASS, MOV_TEXT) to WebVTT, once, into `<appData>/subtitles/embedded`.
 * Extraction reads the whole file, so `vtt` answers `extracting` while it runs and the caller asks again. ASS styling is dropped.
 */
export class EmbeddedSubtitleService {
  private readonly root: string;
  private readonly running = new Set<string>();
  private readonly failures = new Map<string, { message: string; mtimeMs: number; at: number }>();

  public constructor(private readonly tracks: MediaTrackRepository, private readonly locate: () => Promise<FfmpegBinary | null>, appDataPath: string, private readonly now: () => number = Date.now) {
    this.root = join(appDataPath, 'subtitles', embeddedSubtitleDirName);
  }

  /** The movie's embedded text tracks, in file order. */
  public textTracks(movieId: number): MediaTrack[] {
    return (this.tracks.listByMovieIds([movieId]).get(movieId) ?? []).filter(isTextSubtitle);
  }

  public async vtt(movie: PlaybackMovie, order: number): Promise<EmbeddedVtt> {
    if (!this.textTracks(movie.id).some((track) => track.order === order)) throw new EmbeddedSubtitleError('Subtitle track is unavailable', 404);
    const key = `${movie.id}-${order}`; const target = join(this.root, `${key}.vtt`);
    const source = await stat(movie.path).catch(() => { throw new EmbeddedSubtitleError('Movie file is unavailable', 404); });
    const cached = await stat(target).catch(() => null);
    if (cached && cached.mtimeMs >= source.mtimeMs) return { state: 'ready', path: target, size: cached.size };
    if (this.running.has(key)) return { state: 'extracting' };
    const failure = this.failures.get(key);
    if (failure && failure.mtimeMs === source.mtimeMs && this.now() - failure.at < embeddedSubtitleFailureMemoryMs) throw new EmbeddedSubtitleError(failure.message, 422);
    const ffmpeg = await this.locate();
    if (!ffmpeg) throw new EmbeddedSubtitleError('ffmpeg is not installed, so embedded subtitles cannot be extracted', 503);
    // Marked before the first await so a concurrent request (a HEAD probe) joins this extraction instead of starting another.
    if (this.running.has(key)) return { state: 'extracting' };
    this.running.add(key); this.failures.delete(key);
    void this.extract(ffmpeg, movie.path, order, target).catch((error: unknown) => {
      this.failures.set(key, { message: error instanceof Error ? error.message : 'Subtitle extraction failed', mtimeMs: source.mtimeMs, at: this.now() });
    }).finally(() => this.running.delete(key));
    return { state: 'extracting' };
  }

  private async extract(ffmpeg: FfmpegBinary, moviePath: string, order: number, target: string): Promise<void> {
    await mkdir(this.root, { recursive: true });
    const temp = `${target}.${process.pid}-${this.now()}.tmp`;
    try {
      const result = await ffmpeg.run(['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', moviePath, '-map', `0:${order}`, '-f', 'webvtt', temp], embeddedSubtitleExtractTimeoutMs);
      if (result.code !== 0) throw new Error(`Subtitle extraction failed: ${result.stderr.trim().split(/\r?\n/).pop() || `ffmpeg exited with ${result.code}`}`);
      await rename(temp, target);
    } catch (error) {
      await rm(temp, { force: true, maxRetries: 3, retryDelay: 200 }).catch(() => {});
      throw error;
    }
  }
}
