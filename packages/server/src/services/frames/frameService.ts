import { spawn as nodeSpawn } from 'node:child_process';
import type { Readable } from 'node:stream';
import { framePreviewConfig } from '../../config/framePreview.js';
import type { FfmpegBinary } from '../../providers/transcode/ffmpegLocator.js';
import type { MovieRepository } from '../../repositories/movieRepository.js';
import type { PlaybackService } from '../playbackService.js';

/** The part of a child process a grab uses; tests pass a fake. */
export interface FrameProcess {
  stdout: Readable;
  kill(signal?: NodeJS.Signals): boolean;
  once(event: 'close', listener: (code: number | null) => void): unknown;
  once(event: 'error', listener: (error: Error) => void): unknown;
}
export type FrameSpawn = (command: string, args: string[]) => FrameProcess;

export const spawnFrameProcess: FrameSpawn = (command, args) => nodeSpawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });

/** A grab that cannot produce a frame; `status` is what the route answers. */
export class FrameError extends Error {
  public constructor(message: string, public readonly status: number) { super(message); }
}

/** The ffmpeg arguments for one grab: the first keyframe from [timeMs] (any frame when [keyframesOnly] is off), scaled down, as a JPEG on stdout. */
export function frameArgs(path: string, timeMs: number, keyframesOnly = true): string[] {
  return ['-hide_banner', '-loglevel', 'error', '-nostdin', ...(keyframesOnly ? ['-skip_frame', 'nokey'] : []), '-ss', (timeMs / 1000).toFixed(3), '-i', path,
    '-frames:v', '1', '-vf', `scale=${framePreviewConfig.width}:-2`, '-q:v', String(framePreviewConfig.quality), '-f', 'image2', '-c:v', 'mjpeg', 'pipe:1'];
}

/** One request's claim on a (client, movie) slot. Cancelling it stops its grab or drops it from the queue. */
class Ticket {
  public cancelled = false;
  public onCancel: (() => void) | null = null;
  public cancel(): void {
    if (this.cancelled) return;
    this.cancelled = true;
    this.onCancel?.();
  }
}

interface QueuedGrab { start(): void }

/**
 * Frame previews for the seek bar. At most [framePreviewConfig.maxConcurrent] ffmpeg runs at once (the rest queue); a newer
 * request from the same client for the same movie cancels the older; an aborted request kills its ffmpeg; the last
 * [cacheSize] frames are kept, keyed by movie and time rounded to [roundMs].
 */
export class FrameService {
  private readonly cache = new Map<string, Buffer>();
  private readonly active = new Map<string, Ticket>();
  private readonly queue: QueuedGrab[] = [];
  private running = 0;

  public constructor(
    private readonly playback: Pick<PlaybackService, 'movieFile'>,
    private readonly movies: Pick<MovieRepository, 'get'>,
    private readonly locate: () => Promise<FfmpegBinary | null>,
    private readonly spawn: FrameSpawn = spawnFrameProcess
  ) {}

  /**
   * The JPEG for [requestedMs] of a movie, or null when the request was cancelled (superseded by a newer one, or [signal] aborted).
   * Throws MovieUnavailableError for an unknown or unreadable movie and FrameError when no frame could be made.
   */
  public async frame(movieId: number, requestedMs: number, client: string, signal?: AbortSignal): Promise<Buffer | null> {
    const key = `${client}|${movieId}`;
    this.active.get(key)?.cancel();
    const ticket = new Ticket(); this.active.set(key, ticket);
    const abort = () => ticket.cancel();
    if (signal?.aborted) ticket.cancel(); else signal?.addEventListener('abort', abort, { once: true });
    try {
      const file = await this.playback.movieFile(movieId);
      if (ticket.cancelled) return null;
      const timeMs = this.snap(movieId, requestedMs);
      const cacheKey = `${movieId}:${timeMs}`;
      const hit = this.cache.get(cacheKey);
      if (hit) { this.cache.delete(cacheKey); this.cache.set(cacheKey, hit); return hit; }
      const jpeg = await this.grab(file.path, timeMs, ticket);
      if (jpeg) this.remember(cacheKey, jpeg);
      return jpeg;
    } finally {
      signal?.removeEventListener('abort', abort);
      if (this.active.get(key) === ticket) this.active.delete(key);
    }
  }

  /** Rounded to the cache step, then kept inside [0, duration) when the duration is known, or under a sane cap when not. */
  private snap(movieId: number, requestedMs: number): number {
    const rounded = Math.round(Math.max(0, requestedMs) / framePreviewConfig.roundMs) * framePreviewConfig.roundMs;
    const duration = this.movies.get(movieId)?.mediaInfo?.durationMs;
    // One step short of the end: a seek to EOF yields no frame.
    return duration != null && duration >= 0
      ? Math.min(rounded, Math.max(0, duration - framePreviewConfig.roundMs))
      : Math.min(rounded, framePreviewConfig.maxUnknownMs);
  }

  private remember(key: string, jpeg: Buffer): void {
    this.cache.set(key, jpeg);
    while (this.cache.size > framePreviewConfig.cacheSize) this.cache.delete(this.cache.keys().next().value as string);
  }

  private grab(path: string, timeMs: number, ticket: Ticket): Promise<Buffer | null> {
    return new Promise((resolve, reject) => {
      const entry: QueuedGrab = { start: () => void this.run(path, timeMs, ticket, resolve, reject) };
      ticket.onCancel = () => {
        const at = this.queue.indexOf(entry);
        if (at >= 0) { this.queue.splice(at, 1); resolve(null); }
      };
      this.queue.push(entry);
      this.pump();
    });
  }

  private pump(): void {
    while (this.running < framePreviewConfig.maxConcurrent && this.queue.length > 0) { this.running += 1; this.queue.shift()!.start(); }
  }

  /** Runs one grab in an already-taken slot; the slot is given back when ffmpeg has exited (or never started). */
  private async run(path: string, timeMs: number, ticket: Ticket, resolve: (jpeg: Buffer | null) => void, reject: (error: Error) => void): Promise<void> {
    try {
      const binary = await this.locate().catch(() => null);
      if (!binary) { reject(new FrameError('Frame previews need ffmpeg', 503)); return; }
      let bytes = await this.execute(binary.path, frameArgs(path, timeMs, true), ticket);
      // Past the last keyframe (the end of a file) there is nothing to grab; decode up to the time instead.
      if (bytes && bytes.length === 0) bytes = await this.execute(binary.path, frameArgs(path, timeMs, false), ticket);
      if (bytes === null) resolve(null);
      else if (bytes.length === 0) reject(new FrameError('No frame at that time', 404));
      else resolve(bytes);
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.running -= 1;
      this.pump();
    }
  }

  /** One ffmpeg run. Resolves once the process has exited: with its output, or null when the ticket was cancelled (which kills it). */
  private execute(command: string, args: string[], ticket: Ticket): Promise<Buffer | null> {
    return new Promise((resolve, reject) => {
      if (ticket.cancelled) { resolve(null); return; }
      const child = this.spawn(command, args);
      const chunks: Buffer[] = []; let settled = false; let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, framePreviewConfig.timeoutMs);
      const settle = (outcome: () => void) => { if (!settled) { settled = true; clearTimeout(timer); ticket.onCancel = null; outcome(); } };
      ticket.onCancel = () => { child.kill('SIGKILL'); };
      child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
      child.once('error', (error) => settle(() => reject(new FrameError(`ffmpeg could not start: ${error.message}`, 502))));
      child.once('close', (code) => settle(() => {
        if (ticket.cancelled) resolve(null);
        else if (code === 0) resolve(Buffer.concat(chunks));
        else reject(new FrameError(timedOut ? 'ffmpeg timed out' : `ffmpeg exited with code ${code}`, 502));
      }));
    });
  }
}
