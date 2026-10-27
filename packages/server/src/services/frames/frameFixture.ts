import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { FrameProcess, FrameSpawn } from './frameService.js';

/** A few bytes that look like a JPEG, enough for the service and the routes. */
export const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);

/** A stand-in ffmpeg process: the test decides when it produces its frame or fails. kill() ends it the way a real kill does. */
export class FakeFrameRun extends EventEmitter implements FrameProcess {
  public readonly stdout = new PassThrough();
  public killed = false;
  private closed = false;

  public constructor(public readonly command: string, public readonly args: string[]) { super(); }

  public kill(): boolean {
    if (this.killed) return true;
    this.killed = true;
    this.close(null);
    return true;
  }

  /** The frame arrives and ffmpeg exits 0 (or [code]). */
  public finish(bytes: Buffer = fakeJpeg, code = 0): void {
    if (bytes.length > 0) this.stdout.write(bytes);
    this.close(code);
  }

  private close(code: number | null): void {
    if (this.closed) return;
    this.closed = true;
    this.stdout.end();
    setTimeout(() => this.emit('close', code), 0);
  }
}

/** A [FrameSpawn] that records each run. With [auto] every run finishes by itself right after it starts. */
export function fakeFrameSpawner(auto = false) {
  const runs: FakeFrameRun[] = [];
  const spawn: FrameSpawn = (command, args) => {
    const run = new FakeFrameRun(command, args);
    runs.push(run);
    if (auto) setTimeout(() => run.finish(), 0);
    return run;
  };
  return { spawn, runs };
}
