import { bufsizeFactor, ffmpegTimeouts, maxrateFactor } from '../../config/transcode.js';
import type { FfmpegBinary } from './ffmpegLocator.js';
import type { EncodeOptions } from './VideoEncoder.js';

/** Shared pieces of the per-encoder argument lists. */

export function rateArgs(bitrateKbps: number): string[] {
  const kbps = Math.max(1, Math.round(bitrateKbps));
  return ['-b:v', `${kbps}k`, '-maxrate', `${Math.round(kbps * maxrateFactor)}k`, '-bufsize', `${Math.round(kbps * bufsizeFactor)}k`];
}

export function keyframeArgs(segmentSeconds: number): string[] {
  return ['-force_key_frames', `expr:gte(t,n_forced*${segmentSeconds})`];
}

/** True when frames go through system memory (explicit flag, or software filters to run). */
export function usesSoftwareFrames(o: EncodeOptions): boolean {
  return o.softwareDecode || (o.filters?.length ?? 0) > 0;
}

/** `-vf` with the caller's software filters, then a CPU scale to the target height and a pixel format. */
export function softwareFilterArgs(o: EncodeOptions, pixelFormat: 'yuv420p' | 'nv12'): string[] {
  return ['-vf', [...(o.filters ?? []), `scale=-2:${o.targetHeight}`, `format=${pixelFormat}`].join(',')];
}

/** Listed by `-encoders` and a one-frame encode of a black test card exits 0. */
export async function testEncode(ffmpeg: FfmpegBinary, codec: string, pixelFormat: 'yuv420p' | 'nv12', extra: string[] = []): Promise<boolean> {
  if (!ffmpeg.encoders.has(codec)) return false;
  try {
    const result = await ffmpeg.run([
      '-hide_banner', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=320x240:d=1',
      '-frames:v', '1', '-pix_fmt', pixelFormat, '-c:v', codec, ...extra, '-f', 'null', '-'
    ], ffmpegTimeouts.probeEncodeMs);
    return result.code === 0;
  } catch { return false; }
}
