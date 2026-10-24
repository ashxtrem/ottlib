import { spawn as nodeSpawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { access, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { boundaryToleranceMs, ffmpegStderrLines, timelineOffsetSeconds } from '../../config/transcode.js';
import { Fmp4Splitter } from './fmp4Splitter.js';

/** The part of a child process a session uses; tests pass a fake. */
export interface SpawnedProcess {
  stdout: Readable;
  stderr: Readable;
  kill(signal?: NodeJS.Signals): boolean;
  once(event: 'close', listener: (code: number | null) => void): unknown;
  once(event: 'error', listener: (error: Error) => void): unknown;
}
export type SpawnFn = (command: string, args: string[], options: { cwd: string }) => SpawnedProcess;

export const spawnProcess: SpawnFn = (command, args, options) =>
  nodeSpawn(command, args, { cwd: options.cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });

export const segmentFile = (index: number) => `seg-${index}.m4s`;
export const initFile = 'init.mp4';

export interface FfmpegRunOptions {
  spawn: SpawnFn;
  ffmpegPath: string;
  args: string[];
  /** Session folder: ffmpeg runs there, and the init and segment files are written there. */
  dir: string;
  /** Planned segment the first fragment belongs to. */
  startSegment: number;
  /** Planned segment start times (ms). */
  segmentStarts: readonly number[];
}

export interface RunExit {
  /** True when `stop()` ended it. */
  stopped: boolean;
  /** Set when ffmpeg failed: exit code and the last stderr lines. */
  error?: string;
}

/**
 * One ffmpeg process of a session. Its fragmented-MP4 stdout is cut into `init.mp4` and `seg-<n>.m4s`, each fragment
 * matched to the plan by its start time. Emits 'init', 'segment' (n) once a file is in place, and 'exit' (RunExit).
 */
export class FfmpegRun extends EventEmitter {
  /** Newest segment written by this run; startSegment - 1 before the first. */
  public newest: number;
  private readonly child: SpawnedProcess;
  private readonly splitter = new Fmp4Splitter(timelineOffsetSeconds * 1000);
  private readonly stderr: string[] = [];
  private current: { index: number; parts: Buffer[] } | null = null;
  private writes: Promise<void> = Promise.resolve();
  private stopped = false;
  private exited = false;
  /** Set when the output could not be parsed (the run is then stopped as failed). */
  private failure: string | null = null;

  public constructor(private readonly options: FfmpegRunOptions) {
    super();
    this.newest = options.startSegment - 1;
    this.child = options.spawn(options.ffmpegPath, options.args, { cwd: options.dir });
    this.child.stdout.on('data', (chunk: Buffer) => this.onData(chunk));
    this.child.stderr.on('data', (chunk: Buffer) => this.onStderr(chunk));
    this.child.once('error', (error) => this.finish(null, error.message));
    this.child.once('close', (code) => this.finish(code));
  }

  /** False once it exited or was told to stop. */
  public get running(): boolean { return !this.exited && !this.stopped; }

  /** Kills ffmpeg; resolves once it has exited (Windows keeps its working folder locked until then). */
  public stop(): Promise<void> {
    const exited = new Promise<void>((resolve) => { if (this.exited) resolve(); else this.once('exit', () => resolve()); });
    if (!this.exited && !this.stopped) { this.stopped = true; this.child.kill('SIGKILL'); }
    return exited;
  }

  private onStderr(chunk: Buffer): void {
    this.stderr.push(...chunk.toString().split(/\r?\n/).filter((line) => line.trim()));
    if (this.stderr.length > ffmpegStderrLines) this.stderr.splice(0, this.stderr.length - ffmpegStderrLines);
  }

  private onData(chunk: Buffer): void {
    if (this.stopped) return;
    let pieces;
    try { pieces = this.splitter.push(chunk); } catch (error) { this.failure = String(error); void this.stop(); return; }
    for (const piece of pieces) {
      if (piece.kind === 'init') this.queue(() => this.writeInit(piece.bytes));
      else this.addFragment(piece.bytes, piece.startMs);
    }
  }

  /** A fragment opens the next planned segment when it starts at (or past) its boundary; otherwise it joins the current one. */
  private addFragment(bytes: Buffer, startMs: number | null): void {
    const starts = this.options.segmentStarts;
    let index = this.current ? this.current.index : this.options.startSegment;
    if (this.current) {
      if (startMs === null) index += 1;
      else while (index + 1 < starts.length && startMs >= starts[index + 1] - boundaryToleranceMs) index += 1;
    }
    if (!this.current || index !== this.current.index) this.current = { index, parts: [] };
    this.current.parts.push(bytes);
    const parts = [...this.current.parts];
    this.queue(() => this.writeSegment(index, parts));
  }

  private queue(task: () => Promise<void>): void {
    this.writes = this.writes.then(task).catch((error) => { this.stderr.push(`write failed: ${String(error)}`); });
  }

  private async writeInit(bytes: Buffer): Promise<void> {
    const path = join(this.options.dir, initFile);
    // Every run writes the same init segment; keep the first so a request never reads a half-written one.
    if (!(await access(path).then(() => true, () => false))) await this.atomicWrite(path, bytes);
    this.emit('init');
  }

  private async writeSegment(index: number, parts: Buffer[]): Promise<void> {
    if (this.stopped) return;
    await this.atomicWrite(join(this.options.dir, segmentFile(index)), Buffer.concat(parts));
    this.newest = Math.max(this.newest, index);
    this.emit('segment', index);
  }

  private async atomicWrite(path: string, bytes: Buffer): Promise<void> {
    const temporary = `${path}.tmp`;
    await writeFile(temporary, bytes);
    await rename(temporary, path);
  }

  private finish(code: number | null, spawnError?: string): void {
    if (this.exited) return;
    this.exited = true;
    const failed = this.failure !== null || (!this.stopped && (spawnError !== undefined || code !== 0));
    const reason = this.failure ?? spawnError ?? `exited with code ${code}`;
    const error = failed ? `ffmpeg ${reason}${this.stderr.length ? `: ${this.stderr.join('\n')}` : ''}` : undefined;
    void this.writes.then(() => this.emit('exit', { stopped: this.stopped && this.failure === null, ...(error ? { error } : {}) } satisfies RunExit));
  }
}
