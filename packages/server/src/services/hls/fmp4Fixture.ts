/**
 * Test helper: minimal fragmented-MP4 boxes like ffmpeg's `-movflags +frag_keyframe+empty_moov+default_base_moof` output,
 * and a fake ffmpeg process that writes them to stdout. Used by the HLS session tests; not used at runtime.
 */
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { timelineOffsetSeconds } from '../../config/transcode.js';
import type { SpawnedProcess, SpawnFn } from './ffmpegProcess.js';

const u32 = (value: number) => { const buffer = Buffer.alloc(4); buffer.writeUInt32BE(value); return buffer; };
const u64 = (value: number) => { const buffer = Buffer.alloc(8); buffer.writeBigUInt64BE(BigInt(value)); return buffer; };

export function box(type: string, ...payload: Buffer[]): Buffer {
  const body = Buffer.concat(payload);
  return Buffer.concat([u32(body.length + 8), Buffer.from(type, 'latin1'), body]);
}

const fullBox = (type: string, version: number, flags: number, ...payload: Buffer[]) =>
  box(type, Buffer.from([version, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255]), ...payload);

export const VIDEO_TIMESCALE = 90_000;

/** ftyp + moov with one video track (id 1) and one audio track (id 2). */
export function initSegment(): Buffer {
  const trak = (id: number, handler: string, timescale: number) => box('trak',
    fullBox('tkhd', 0, 3, u32(0), u32(0), u32(id), u32(0), u32(0)),
    box('mdia', fullBox('mdhd', 0, 0, u32(0), u32(0), u32(timescale), u32(0)), fullBox('hdlr', 0, 0, u32(0), Buffer.from(handler, 'latin1'), Buffer.alloc(13))));
  return Buffer.concat([box('ftyp', Buffer.from('isom', 'latin1'), u32(512)), box('moov', fullBox('mvhd', 0, 0, Buffer.alloc(96)), trak(1, 'vide', VIDEO_TIMESCALE), trak(2, 'soun', 48_000))]);
}

/** moof + mdat whose first video sample is presented at `startMs` on the film's timeline. */
export function fragment(startMs: number, payload = Buffer.from('frame-data')): Buffer {
  const ctsTicks = 3_003;
  const decode = Math.round(((startMs / 1000) + timelineOffsetSeconds) * VIDEO_TIMESCALE) - ctsTicks;
  const traf = box('traf', fullBox('tfhd', 0, 0x020000, u32(1)), fullBox('tfdt', 1, 0, u64(decode)), fullBox('trun', 0, 0x000801, u32(1), u32(0), u32(ctsTicks)));
  return Buffer.concat([box('moof', fullBox('mfhd', 0, 0, u32(1)), traf), box('mdat', payload)]);
}

export class FakeFfmpeg extends EventEmitter implements SpawnedProcess {
  public readonly stdout = new PassThrough();
  public readonly stderr = new PassThrough();
  public killed = false;

  public constructor(public readonly args: string[], public readonly cwd: string) { super(); }

  /** Writes the init segment and one fragment per start time. */
  public produce(startsMs: number[], withInit = true): void {
    this.stdout.write(Buffer.concat([...(withInit ? [initSegment()] : []), ...startsMs.map((start) => fragment(start))]));
  }

  public exit(code: number, stderr = ''): void {
    if (stderr) this.stderr.write(stderr);
    setImmediate(() => { this.stdout.end(); this.emit('close', code); });
  }

  public kill(): boolean {
    if (this.killed) return false;
    this.killed = true;
    setImmediate(() => this.emit('close', null));
    return true;
  }
}

/** A SpawnFn that records each fake process it starts. */
export function fakeSpawner(): { spawn: SpawnFn; runs: FakeFfmpeg[] } {
  const runs: FakeFfmpeg[] = [];
  return { runs, spawn: (_command, args, options) => { const run = new FakeFfmpeg(args, options.cwd); runs.push(run); return run; } };
}
