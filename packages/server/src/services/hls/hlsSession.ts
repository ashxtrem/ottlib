import { rm, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { PlaybackMode } from '@ottlib/shared';
import { transcodeSessionLimits as limits } from '../../config/transcode.js';
import { FfmpegRun, initFile, segmentFile, type RunExit, type SpawnFn } from './ffmpegProcess.js';
import type { SegmentPlan } from './segmentPlan.js';

export interface HlsSessionOptions {
  id: string;
  movieId: number;
  deviceId?: string;
  mode: Exclude<PlaybackMode, 'direct'>;
  plan: SegmentPlan;
  dir: string;
  spawn: SpawnFn;
  ffmpegPath: string;
  /** ffmpeg arguments for a run that starts at segment n. */
  argsFor: (startSegment: number) => string[];
  now: () => number;
  log: (message: string) => void;
}

interface Waiter { segment: number | 'init'; resolve: () => void; reject: (error: Error) => void; timer: NodeJS.Timeout }

export class SegmentNotFoundError extends Error {}

/**
 * One playback session: its folder, the current ffmpeg run, and the rules for a segment request — serve it, wait for it
 * (it is just ahead of the run), or restart ffmpeg there. Stops a run that gets too far ahead and resumes it later.
 */
export class HlsSession {
  public lastAccessMs: number;
  private run: FfmpegRun | null = null;
  private readonly produced = new Set<number>();
  private hasInit = false;
  private restartPoint = 0;
  private lastRequested = 0;
  private readonly waiters = new Set<Waiter>();
  private readonly openedAt: number;
  private firstSegmentLogged = false;
  private closed = false;

  public constructor(public readonly options: HlsSessionOptions) {
    this.openedAt = options.now(); this.lastAccessMs = this.openedAt;
  }

  public get id(): string { return this.options.id; }
  public get segmentCount(): number { return this.options.plan.segments.length; }
  public get running(): boolean { return this.run?.running ?? false; }

  /** Starts (or restarts) ffmpeg at segment n. */
  public start(segment: number): void {
    if (this.closed) return;
    void this.run?.stop();
    this.restartPoint = segment;
    this.rejectWaiters((waiter) => waiter.segment !== 'init' && (waiter.segment < segment || waiter.segment > segment + limits.segmentWaitWindow), 'Playback moved elsewhere');
    const run = new FfmpegRun({
      spawn: this.options.spawn, ffmpegPath: this.options.ffmpegPath, args: this.options.argsFor(segment), dir: this.options.dir,
      startSegment: segment, segmentStarts: this.options.plan.segments.map((item) => item.start),
    });
    this.run = run;
    run.on('init', () => { this.hasInit = true; this.settle('init'); });
    run.on('segment', (index: number) => this.onSegment(run, index));
    run.once('exit', (exit: RunExit) => this.onExit(run, exit));
  }

  /** Path of segment n once it exists. */
  public async segment(index: number): Promise<string> {
    if (!Number.isInteger(index) || index < 0 || index >= this.segmentCount) throw new SegmentNotFoundError(`No segment ${index}`);
    this.touch(); this.lastRequested = index;
    void this.deleteBehind(index);
    if (!this.produced.has(index)) {
      if (!this.isNear(index)) this.start(this.resumePoint(index));
      await this.waitFor(index);
    } else if (!this.running) this.resumeIfClose();
    return join(this.options.dir, segmentFile(index));
  }

  public async init(): Promise<string> {
    this.touch();
    if (!this.hasInit) {
      if (!this.running) this.start(this.lastRequested);
      await this.waitFor('init');
    }
    return join(this.options.dir, initFile);
  }

  public async close(): Promise<void> {
    this.closed = true;
    this.rejectWaiters(() => true, 'Session closed');
    const run = this.run; this.run = null;
    if (run) await Promise.race([run.stop(), new Promise((resolve) => setTimeout(resolve, 5_000).unref())]);
    await rm(this.options.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }).catch(() => undefined);
  }

  private touch(): void { this.lastAccessMs = this.options.now(); }

  /** Between the restart point and a few segments past the newest one the running ffmpeg has written. */
  private isNear(index: number): boolean {
    if (!this.run?.running) return false;
    return index >= this.restartPoint && index <= this.run.newest + limits.segmentWaitWindow;
  }

  /** A run stopped for being far ahead resumes where it stopped when the request is just past that; else at the request. */
  private resumePoint(index: number): number {
    const stoppedAt = this.run && !this.run.running ? this.run.newest : -1;
    return stoppedAt >= 0 && index > stoppedAt && index <= stoppedAt + 1 + limits.segmentWaitWindow ? stoppedAt + 1 : index;
  }

  private resumeIfClose(): void {
    const newest = this.run?.newest ?? -1;
    if (newest + 1 < this.segmentCount && this.lastRequested >= newest - limits.restartWithinSegments && this.produced.has(newest)) this.start(newest + 1);
  }

  private onSegment(run: FfmpegRun, index: number): void {
    if (run !== this.run) return;
    this.produced.add(index);
    if (!this.firstSegmentLogged) {
      this.firstSegmentLogged = true;
      this.options.log(`HLS ${this.options.mode} session ${this.id}: first segment (${index}) after ${this.options.now() - this.openedAt} ms`);
    }
    this.settle(index);
    if (index - this.lastRequested >= limits.stopAheadSegments) void run.stop();
  }

  private onExit(run: FfmpegRun, exit: RunExit): void {
    if (exit.error) this.options.log(`HLS session ${this.id}: ${exit.error}`);
    if (run !== this.run) return;
    if (!exit.stopped) this.rejectWaiters(() => true, exit.error ?? 'ffmpeg finished without this segment');
  }

  private waitFor(segment: number | 'init'): Promise<void> {
    if (segment === 'init' ? this.hasInit : this.produced.has(segment)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const waiter: Waiter = {
        segment, resolve, reject,
        timer: setTimeout(() => { this.waiters.delete(waiter); reject(new Error(`Timed out waiting for ${segment === 'init' ? 'the init segment' : `segment ${segment}`}`)); }, limits.segmentWaitMs),
      };
      this.waiters.add(waiter);
    });
  }

  private settle(segment: number | 'init'): void {
    for (const waiter of [...this.waiters]) {
      if (waiter.segment !== segment) continue;
      clearTimeout(waiter.timer); this.waiters.delete(waiter); waiter.resolve();
    }
  }

  private rejectWaiters(match: (waiter: Waiter) => boolean, message: string): void {
    for (const waiter of [...this.waiters]) {
      if (!match(waiter)) continue;
      clearTimeout(waiter.timer); this.waiters.delete(waiter); waiter.reject(new Error(message));
    }
  }

  /** Segments more than `deleteSegmentsBehind` before the request are removed from disk. */
  private async deleteBehind(index: number): Promise<void> {
    for (const segment of [...this.produced]) {
      if (segment >= index - limits.deleteSegmentsBehind) continue;
      this.produced.delete(segment);
      await unlink(join(this.options.dir, segmentFile(segment))).catch(() => undefined);
    }
  }
}
