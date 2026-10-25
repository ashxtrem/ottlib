import { pictureAreaConfig } from '../../config/pictureArea.js';
import type { FfmpegBinary } from '../../providers/transcode/ffmpegLocator.js';
import { parseCropLine, type CropBox } from './pictureAreaMath.js';

/** Where in the runtime (seconds) the samples are taken: evenly over the configured share of it. */
export function samplePositionsSeconds(durationMs: number, config = pictureAreaConfig): number[] {
  const points = Math.max(1, config.samplePoints);
  return Array.from({ length: points }, (_, index) => {
    const share = points === 1 ? (config.rangeStart + config.rangeEnd) / 2 : config.rangeStart + ((config.rangeEnd - config.rangeStart) * index) / (points - 1);
    return Math.round(durationMs * share) / 1000;
  });
}

export function cropDetectArgs(filePath: string, seconds: number, config = pictureAreaConfig): string[] {
  return ['-hide_banner', '-ss', String(seconds), '-i', filePath, '-frames:v', String(config.framesPerSample),
    '-vf', `cropdetect=limit=${config.cropLimit}:round=${config.cropRound}:reset=0`, '-an', '-sn', '-f', 'null', '-'];
}

/** What the background pass needs from a detector: the cropdetect box of each sample point that worked. */
export interface PictureDetector {
  detect(ffmpeg: FfmpegBinary, filePath: string, durationMs: number): Promise<CropBox[]>;
}

/** Runs ffmpeg cropdetect (through the located ffmpeg, i.e. `spawnExec`) at each sample point, one after another. */
export class CropDetector implements PictureDetector {
  public async detect(ffmpeg: FfmpegBinary, filePath: string, durationMs: number): Promise<CropBox[]> {
    const boxes: CropBox[] = [];
    for (const seconds of samplePositionsSeconds(durationMs)) {
      try {
        const result = await ffmpeg.run(cropDetectArgs(filePath, seconds), pictureAreaConfig.sampleTimeoutMs);
        const box = result.code === 0 ? parseCropLine(result.stderr) : null;
        if (box) boxes.push(box);
      } catch { /* a failed or timed-out sample is skipped */ }
    }
    return boxes;
  }
}
