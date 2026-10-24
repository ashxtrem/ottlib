import { spawn } from 'node:child_process';
import { ffmpegDefaultCommand, ffmpegEnvVar, ffmpegTimeouts } from '../../config/transcode.js';

export interface ExecResult { code: number | null; stdout: string; stderr: string }
/**
 * Runs a command to completion. Resolves with its exit code and output (a non-zero exit is not an error);
 * rejects only when the process cannot start (e.g. ENOENT) or times out. Injectable so tests use a fake.
 */
export type ExecFn = (command: string, args: string[], timeoutMs: number) => Promise<ExecResult>;

/** A located ffmpeg: what it can do and a way to run it. Encoders use `run` for their test encode. */
export interface FfmpegBinary {
  path: string;
  /** First line of `-version`, e.g. `ffmpeg version 7.1-full_build ...`. */
  version: string;
  encoders: ReadonlySet<string>;
  filters: ReadonlySet<string>;
  run(args: string[], timeoutMs: number): Promise<ExecResult>;
}

export const spawnExec: ExecFn = (command, args, timeoutMs) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { windowsHide: true });
  let stdout = ''; let stderr = ''; let settled = false;
  const finish = (callback: () => void) => { if (!settled) { settled = true; clearTimeout(timeout); callback(); } };
  const timeout = setTimeout(() => { child.kill(); finish(() => reject(new Error(`${command} timed out after ${timeoutMs} ms`))); }, timeoutMs);
  const capture = (current: string, chunk: Buffer) => current.length > ffmpegTimeouts.maxOutputBytes ? current : current + chunk.toString();
  child.stdout.on('data', (chunk: Buffer) => { stdout = capture(stdout, chunk); });
  child.stderr.on('data', (chunk: Buffer) => { stderr = capture(stderr, chunk); });
  child.once('error', (error) => finish(() => reject(error)));
  child.once('close', (code) => finish(() => resolve({ code, stdout, stderr })));
});

/** Names from `ffmpeg -encoders` (lines after the `------` divider, e.g. ` V....D libx264  libx264 H.264 ...`). */
export function parseEncoders(output: string): Set<string> {
  const names = new Set<string>();
  const divider = output.indexOf('------');
  for (const line of output.slice(divider < 0 ? 0 : divider + 6).split(/\r?\n/)) {
    const match = /^\s*[VAS][A-Z.]{5}\s+(\S+)/.exec(line);
    if (match) names.add(match[1]);
  }
  return names;
}

/** Names from `ffmpeg -filters` (e.g. ` TSC libplacebo  V->V  Apply various GPU filters ...`). */
export function parseFilters(output: string): Set<string> {
  const names = new Set<string>();
  for (const line of output.split(/\r?\n/)) {
    const match = /^\s*[T.][S.][C.]?\s+(\S+)\s+\S*->\S*/.exec(line);
    if (match) names.add(match[1]);
  }
  return names;
}

/** Finds ffmpeg once (`FFMPEG_PATH`, else `ffmpeg` on PATH) and caches what it supports; null when it is missing. */
export class FfmpegLocator {
  private cached: Promise<FfmpegBinary | null> | undefined;

  public constructor(
    private readonly exec: ExecFn = spawnExec,
    private readonly command = process.env[ffmpegEnvVar] || ffmpegDefaultCommand
  ) {}

  public locate(): Promise<FfmpegBinary | null> {
    this.cached ??= this.inspect();
    return this.cached;
  }

  private async inspect(): Promise<FfmpegBinary | null> {
    const info = (args: string[]) => this.exec(this.command, ['-hide_banner', ...args], ffmpegTimeouts.infoMs);
    let version: ExecResult;
    try { version = await this.exec(this.command, ['-version'], ffmpegTimeouts.infoMs); } catch { return null; }
    if (version.code !== 0) return null;
    const [encoders, filters] = await Promise.all([info(['-encoders']), info(['-filters'])].map((p) => p.catch(() => null)));
    const exec = this.exec; const path = this.command;
    return {
      path,
      version: version.stdout.split(/\r?\n/)[0]?.trim() ?? '',
      encoders: parseEncoders(encoders?.stdout ?? ''),
      filters: parseFilters(filters?.stdout ?? ''),
      run: (args, timeoutMs) => exec(path, args, timeoutMs),
    };
  }
}
