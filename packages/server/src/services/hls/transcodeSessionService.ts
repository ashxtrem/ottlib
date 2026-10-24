import { randomBytes } from 'node:crypto';
import { mkdir, readdir, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TranscodeEncoder } from '@ottlib/shared';
import { transcodeDirEnvVar, transcodeDirName, transcodeSessionLimits as limits } from '../../config/transcode.js';
import type { EncoderRegistry } from '../../providers/transcode/encoderRegistry.js';
import type { FfmpegBinary } from '../../providers/transcode/ffmpegLocator.js';
import { pickToneMapChain } from '../../providers/transcode/toneMapFilters.js';
import { buildFfmpegArgs, type FfmpegCommandInput } from './ffmpegCommand.js';
import { spawnProcess, type SpawnFn } from './ffmpegProcess.js';
import { buildHlsPlaylist } from './hlsPlaylist.js';
import { HardwareDecodeCheck } from './hardwareDecodeCheck.js';
import { HlsSession } from './hlsSession.js';
import { planSegments, type SegmentPlan } from './segmentPlan.js';
import { SessionBusyError, type HlsSessionHandle, type HlsSessionInput, type HlsSessionOpener } from './sessionOpener.js';
import { needsSoftwareDecode, targetBitrateKbps, targetHeight } from './transcodeTarget.js';

export interface TranscodeSessionServiceOptions {
  locate: () => Promise<FfmpegBinary | null>;
  encoders: (ffmpeg: FfmpegBinary) => EncoderRegistry;
  encoderSetting: () => TranscodeEncoder;
  /** '?key=…' for a movie when an access PIN is set, else ''. */
  streamQuery: (movieId: number) => string;
  spawn?: SpawnFn;
  /** Temp root; default `OTTLIB_TRANSCODE_DIR`, else `os.tmpdir()/ottlib-hls`. */
  root?: string;
  now?: () => number;
  log?: (message: string) => void;
}

/** A session that does not exist, or belongs to another movie. */
export class SessionNotFoundError extends Error {}

export function defaultTranscodeRoot(): string {
  return process.env[transcodeDirEnvVar] || join(tmpdir(), transcodeDirName);
}

const hevcLabels = new Set(['hevc', 'h.265', 'h265']);

/** Index of the planned segment that contains `ms` (0 when absent or before the first). */
export function segmentAt(plan: SegmentPlan, ms: number | undefined): number {
  if (!ms || ms <= 0) return 0;
  let index = 0;
  plan.segments.forEach((segment, at) => { if (segment.start <= ms) index = at; });
  return index;
}

/** Opens, serves and reaps remux/transcode HLS sessions (one ffmpeg each, files in a temp folder per session). */
export class TranscodeSessionService implements HlsSessionOpener {
  public readonly root: string;
  private readonly sessions = new Map<string, HlsSession>();
  /** Opens past the limit check that have not added their session yet. */
  private readonly opening = { remux: 0, transcode: 0 };
  private readonly spawn: SpawnFn;
  private readonly now: () => number;
  private readonly log: (message: string) => void;
  private registry: { ffmpeg: FfmpegBinary; encoders: EncoderRegistry } | null = null;
  private sweeper: NodeJS.Timeout | null = null;
  private readonly hardware: HardwareDecodeCheck;

  public constructor(private readonly options: TranscodeSessionServiceOptions) {
    this.root = options.root ?? defaultTranscodeRoot();
    this.spawn = options.spawn ?? spawnProcess;
    this.now = options.now ?? Date.now;
    this.log = options.log ?? ((message) => console.info(message));
    this.hardware = new HardwareDecodeCheck(this.log);
  }

  /** Empties the temp root (left over from a previous run) and starts the idle sweep. Called at server start. */
  public async start(): Promise<void> {
    await rm(this.root, { recursive: true, force: true }).catch(() => undefined);
    await mkdir(this.root, { recursive: true });
    this.sweeper ??= setInterval(() => { void this.sweep(); }, limits.sweepIntervalMs);
    this.sweeper.unref();
  }

  /** Ends every session, then removes the temp root if nothing else is in it. */
  public async shutdown(): Promise<void> {
    if (this.sweeper) clearInterval(this.sweeper);
    this.sweeper = null;
    await Promise.all([...this.sessions.keys()].map((id) => this.closeSession(id)));
    if ((await readdir(this.root).catch(() => ['?'])).length === 0) await rmdir(this.root).catch(() => undefined);
  }

  public async open(input: HlsSessionInput): Promise<HlsSessionHandle> {
    const mode = input.decision.mode;
    if (mode === 'direct') throw new Error('A direct decision needs no session');
    const ffmpeg = await this.options.locate();
    if (!ffmpeg) throw new Error('ffmpeg is not available');
    const durationMs = input.mediaInfo.durationMs;
    if (!durationMs || durationMs <= 0) throw new Error('The file has no known duration');
    if (input.deviceId) {
      const previous = [...this.sessions.values()].filter((session) => session.options.deviceId === input.deviceId);
      await Promise.all(previous.map((session) => this.closeSession(session.id)));
    }
    // Check and reserve in one synchronous step, so opens that overlap across the awaits below cannot pass the cap together.
    const max = mode === 'transcode' ? limits.maxTranscodeSessions : limits.maxRemuxSessions;
    if ([...this.sessions.values()].filter((session) => session.options.mode === mode).length + this.opening[mode] >= max) {
      throw new SessionBusyError(`All ${max} ${mode} sessions are in use; stop playback on another device and try again`);
    }
    this.opening[mode] += 1;
    try {
      return await this.create(input, mode, durationMs, ffmpeg);
    } finally {
      this.opening[mode] -= 1;
    }
  }

  private async create(input: HlsSessionInput, mode: 'remux' | 'transcode', durationMs: number, ffmpeg: FfmpegBinary): Promise<HlsSessionHandle> {
    const plan = mode === 'remux' ? planSegments({ mode, durationMs, keyframesMs: input.keyframesMs }) : planSegments({ mode, durationMs });
    const video = await this.videoFor(input, ffmpeg);
    const id = randomBytes(8).toString('hex');
    const dir = join(this.root, id);
    await mkdir(dir, { recursive: true });
    const session = new HlsSession({
      id, movieId: input.movie.id, deviceId: input.deviceId, mode, plan, dir, spawn: this.spawn, ffmpegPath: ffmpeg.path,
      argsFor: (start) => buildFfmpegArgs({
        inputPath: input.movie.path, startSegment: start, startMs: plan.segments[start].start, nextStartMs: plan.segments[start + 1]?.start ?? null,
        video, audio: this.audioFor(input), burnSubtitleOrder: mode === 'transcode' ? input.decision.burnSubtitleOrder : null,
      }),
      now: this.now, log: this.log,
    });
    this.sessions.set(id, session);
    session.start(segmentAt(plan, input.startMs));
    const base = `/api/hls/${input.movie.id}/${id}`;
    return { playlistUrl: `${base}/main.m3u8${this.options.streamQuery(input.movie.id)}`, sessionUrl: base };
  }

  public playlist(movieId: number, id: string): string {
    const session = this.get(movieId, id);
    return buildHlsPlaylist(session.options.plan, this.options.streamQuery(movieId));
  }

  public async init(movieId: number, id: string): Promise<string> { return this.get(movieId, id).init(); }

  public async segment(movieId: number, id: string, index: number): Promise<string> { return this.get(movieId, id).segment(index); }

  public async close(movieId: number, id: string): Promise<void> {
    this.get(movieId, id);
    await this.closeSession(id);
  }

  /** Kills sessions with no request for `idleTimeoutMs`. Runs every `sweepIntervalMs` once started. */
  public async sweep(): Promise<void> {
    const cutoff = this.now() - limits.idleTimeoutMs;
    const idle = [...this.sessions.values()].filter((session) => session.lastAccessMs < cutoff);
    await Promise.all(idle.map((session) => this.closeSession(session.id)));
  }

  public sessionCount(): number { return this.sessions.size; }

  private get(movieId: number, id: string): HlsSession {
    const session = this.sessions.get(id);
    if (!session || session.options.movieId !== movieId) throw new SessionNotFoundError('No such playback session');
    return session;
  }

  private async closeSession(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (!session) return;
    this.sessions.delete(id);
    await session.close();
  }

  private audioFor(input: HlsSessionInput): FfmpegCommandInput['audio'] {
    const { audioOrder, audioCopy } = input.decision;
    return audioOrder === null ? null : { order: audioOrder, copy: audioCopy, channels: input.audioChannels ?? null };
  }

  private async videoFor(input: HlsSessionInput, ffmpeg: FfmpegBinary): Promise<FfmpegCommandInput['video']> {
    if (input.decision.mode === 'remux') return { kind: 'copy', hevc: hevcLabels.has(input.mediaInfo.videoCodec?.toLowerCase() ?? '') };
    if (this.registry?.ffmpeg !== ffmpeg) this.registry = { ffmpeg, encoders: this.options.encoders(ffmpeg) };
    const encoder = await this.registry.encoders.pick(this.options.encoderSetting());
    if (!encoder) throw new Error('No working video encoder was found in ffmpeg');
    const toneMap = input.decision.toneMap ? pickToneMapChain(ffmpeg.filters) : null;
    if (input.decision.toneMap && !toneMap) this.log('This ffmpeg build cannot tone-map HDR; transcoding without it');
    const height = targetHeight(input.mediaInfo.height, input.maxHeight);
    // The GPU path is only tried when nothing forces CPU frames anyway (burn-in, tone-mapping, a missing GPU scaler).
    const cpuFrames = toneMap !== null || input.decision.burnSubtitleOrder !== null || needsSoftwareDecode(encoder, ffmpeg.filters);
    const softwareDecode = cpuFrames || !(await this.hardware.works(ffmpeg, encoder, input.movie.path, input.mediaInfo.videoCodec));
    return { kind: 'encode', encoder, targetHeight: height, bitrateKbps: targetBitrateKbps(height, input.mediaInfo.videoBitRate), softwareDecode, toneMap };
  }
}
