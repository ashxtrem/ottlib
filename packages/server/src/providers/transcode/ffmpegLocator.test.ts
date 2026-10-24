import { describe, expect, it, vi } from 'vitest';
import { FfmpegLocator, parseEncoders, parseFilters, type ExecFn } from './ffmpegLocator.js';

const encodersOutput = `Encoders:
 V..... = Video
 A..... = Audio
 S..... = Subtitle
 .F.... = Frame-level multithreading
 ------
 V....D libx264              libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 (codec h264)
 V....D h264_nvenc           NVIDIA NVENC H.264 encoder (codec h264)
 V..... h264_qsv             H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 (Intel Quick Sync Video acceleration) (codec h264)
 A....D aac                  AAC (Advanced Audio Coding)
`;

const filtersOutput = `Filters:
  T.. = Timeline support
  .S. = Slice threading
  ..C = Command support
  A = Audio input/output
  V = Video input/output
  N = Dynamic number and/or type of input/output
  | = Source or sink filter
 ... abuffer           |->A       Buffer audio frames, and make them accessible to the filterchain.
 ..C libplacebo        N->N       Apply various GPU filters from libplacebo
 TSC scale             V->V       Scale the input video size and/or convert the image format.
 ... tonemap_opencl    V->V       Perform HDR to SDR conversion with tonemapping.
 .S. zscale            V->V       Apply resizing, colorspace and bit depth conversion.
`;

function fakeExec(overrides: Partial<Record<string, string>> = {}): ExecFn {
  return vi.fn(async (_command: string, args: string[]) => {
    const flag = args.find((arg) => arg.startsWith('-') && arg !== '-hide_banner') ?? '';
    const stdout = overrides[flag] ?? { '-version': 'ffmpeg version 7.1-full_build Copyright (c) 2000-2024\nbuilt with gcc', '-encoders': encodersOutput, '-filters': filtersOutput }[flag] ?? '';
    return { code: 0, stdout, stderr: '' };
  });
}

describe('parseEncoders', () => {
  it('lists encoder names after the divider, not the legend', () => {
    const names = parseEncoders(encodersOutput);
    expect([...names]).toEqual(['libx264', 'h264_nvenc', 'h264_qsv', 'aac']);
  });
});

describe('parseFilters', () => {
  it('lists filter names and skips the legend', () => {
    const names = parseFilters(filtersOutput);
    expect([...names]).toEqual(['abuffer', 'libplacebo', 'scale', 'tonemap_opencl', 'zscale']);
  });
});

describe('FfmpegLocator', () => {
  it('reads version, encoders and filters once and caches them', async () => {
    const exec = fakeExec();
    const locator = new FfmpegLocator(exec, 'C:/tools/ffmpeg.exe');
    const first = await locator.locate();
    const second = await locator.locate();
    expect(second).toBe(first);
    expect(first?.path).toBe('C:/tools/ffmpeg.exe');
    expect(first?.version).toBe('ffmpeg version 7.1-full_build Copyright (c) 2000-2024');
    expect(first?.encoders.has('h264_nvenc')).toBe(true);
    expect(first?.filters.has('zscale')).toBe(true);
    expect(exec).toHaveBeenCalledTimes(3);
  });

  it('returns null when ffmpeg cannot be started', async () => {
    const exec: ExecFn = vi.fn(async () => { throw Object.assign(new Error('spawn ffmpeg ENOENT'), { code: 'ENOENT' }); });
    expect(await new FfmpegLocator(exec, 'ffmpeg').locate()).toBeNull();
  });

  it('returns null when -version exits non-zero', async () => {
    const exec: ExecFn = vi.fn(async () => ({ code: 1, stdout: '', stderr: 'bad' }));
    expect(await new FfmpegLocator(exec, 'ffmpeg').locate()).toBeNull();
  });

  it('runs commands through the same binary', async () => {
    const exec = fakeExec();
    const ffmpeg = await new FfmpegLocator(exec, 'ffmpeg-custom').locate();
    await ffmpeg?.run(['-x'], 1000);
    expect(exec).toHaveBeenLastCalledWith('ffmpeg-custom', ['-x'], 1000);
  });

  it('uses FFMPEG_PATH when set', async () => {
    vi.stubEnv('FFMPEG_PATH', 'D:/ff/ffmpeg.exe');
    try {
      const exec = fakeExec();
      await new FfmpegLocator(exec).locate();
      expect(exec).toHaveBeenCalledWith('D:/ff/ffmpeg.exe', ['-version'], expect.any(Number));
    } finally { vi.unstubAllEnvs(); }
  });
});
