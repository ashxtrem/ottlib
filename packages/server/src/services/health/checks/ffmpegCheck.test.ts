import { describe, expect, it } from 'vitest';
import type { FfmpegBinary } from '../../../providers/transcode/ffmpegLocator.js';
import { ffmpegCheck } from './ffmpegCheck.js';

describe('ffmpeg check', () => {
  it('is ok when ffmpeg is found', async () => {
    const binary = { path: 'ffmpeg', version: 'ffmpeg version 7.1', encoders: new Set(), filters: new Set(), run: async () => ({ code: 0, stdout: '', stderr: '' }) } as unknown as FfmpegBinary;
    expect(await ffmpegCheck(async () => binary).run()).toEqual({ state: 'ok', message: 'ffmpeg version 7.1' });
  });

  it('warns that transcoding is off when ffmpeg is missing', async () => {
    const result = await ffmpegCheck(async () => null).run();
    expect(result.state).toBe('warn');
    expect(result.message).toMatch(/transcoding is off/);
  });
});
