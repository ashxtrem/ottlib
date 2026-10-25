import { describe, expect, it, vi } from 'vitest';
import type { FfmpegBinary } from '../../providers/transcode/ffmpegLocator.js';
import { CropDetector, cropDetectArgs, samplePositionsSeconds } from './cropDetector.js';

function fakeFfmpeg(run: FfmpegBinary['run']): FfmpegBinary {
  return { path: 'ffmpeg', version: 'test', encoders: new Set(), filters: new Set(), run };
}

describe('cropDetector', () => {
  it('spreads 8 sample points evenly over 10-90% of the runtime', () => {
    const seconds = samplePositionsSeconds(1_000_000);
    expect(seconds).toHaveLength(8);
    expect(seconds[0]).toBe(100);
    expect(seconds[7]).toBe(900);
    expect(seconds[1] - seconds[0]).toBeCloseTo(800 / 7, 2);
  });

  it('builds the cropdetect command', () => {
    expect(cropDetectArgs('E:/m.mkv', 100)).toEqual(['-hide_banner', '-ss', '100', '-i', 'E:/m.mkv', '-frames:v', '3',
      '-vf', 'cropdetect=limit=0.1:round=2:reset=0', '-an', '-sn', '-f', 'null', '-']);
  });

  it('skips samples that fail, time out or print no crop line', async () => {
    let call = 0;
    const run = vi.fn(async () => {
      call += 1;
      if (call === 1) throw new Error('timed out');
      if (call === 2) return { code: 1, stdout: '', stderr: 'crop=1:1:0:0' };
      if (call === 3) return { code: 0, stdout: '', stderr: 'no crop here' };
      return { code: 0, stdout: '', stderr: 'crop=1920:800:0:140' };
    });
    const boxes = await new CropDetector().detect(fakeFfmpeg(run), 'E:/m.mkv', 600_000);
    expect(run).toHaveBeenCalledTimes(8);
    expect(boxes).toHaveLength(5);
    expect(boxes[0]).toEqual({ w: 1920, h: 800, x: 0, y: 140 });
  });
});
