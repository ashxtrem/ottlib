import { bitrateLadderKbps, maxTranscodeHeight } from '../../config/transcode.js';
import type { VideoEncoder } from '../../providers/transcode/VideoEncoder.js';

/** Source height kept, capped at 2160p and at the client's `maxHeight` (0 or absent = no cap); 1080p when unknown. */
export function targetHeight(sourceHeight: number | null, maxHeight?: number): number {
  const cap = maxHeight && maxHeight > 0 ? Math.min(maxHeight, maxTranscodeHeight) : maxTranscodeHeight;
  const height = Math.min(sourceHeight && sourceHeight > 0 ? sourceHeight : 1080, cap);
  return Math.max(2, height - (height % 2));
}

/** min(source bitrate, the ladder row for the output height). */
export function targetBitrateKbps(height: number, sourceBitRate: number | null): number {
  const ladder = bitrateLadderKbps.find((row) => height >= row.minHeight)?.kbps ?? bitrateLadderKbps[bitrateLadderKbps.length - 1].kbps;
  return sourceBitRate && sourceBitRate > 0 ? Math.min(ladder, Math.round(sourceBitRate / 1000)) : ladder;
}

/** GPU scalers each hardware path needs; without them in the build, frames go through the CPU instead. */
const gpuScalers: Partial<Record<VideoEncoder['name'], string>> = { nvenc: 'scale_cuda', qsv: 'scale_qsv' };

export function needsSoftwareDecode(encoder: VideoEncoder, filters: ReadonlySet<string>): boolean {
  const scaler = gpuScalers[encoder.name];
  return scaler !== undefined && !filters.has(scaler);
}
