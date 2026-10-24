import { describe, expect, it, vi } from 'vitest';
import { amfEncoder } from './amfEncoder.js';
import { videoEncoders } from './encoderRegistry.js';
import type { FfmpegBinary } from './ffmpegLocator.js';
import { nvencEncoder } from './nvencEncoder.js';
import { qsvEncoder } from './qsvEncoder.js';
import type { EncodeOptions } from './VideoEncoder.js';
import { x264Encoder } from './x264Encoder.js';

const hardware: EncodeOptions = { targetHeight: 1080, bitrateKbps: 12_000, segmentSeconds: 4, softwareDecode: false };
const software: EncodeOptions = { ...hardware, softwareDecode: true, filters: ['subtitles=si=0'] };

function value(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index < 0 ? undefined : args[index + 1];
}

describe.each(videoEncoders.map((encoder) => [encoder.name, encoder] as const))('%s encoder', (_name, encoder) => {
  it('sets codec, bitrate ladder rates and forced keyframes', () => {
    const { output } = encoder.args(hardware);
    expect(value(output, '-c:v')).toBe(encoder.codec);
    expect(value(output, '-b:v')).toBe('12000k');
    expect(value(output, '-maxrate')).toBe('18000k');
    expect(value(output, '-bufsize')).toBe('24000k');
    expect(value(output, '-force_key_frames')).toBe('expr:gte(t,n_forced*4)');
  });

  it('runs software filters before a CPU scale and drops hardware decode', () => {
    const { input, output } = encoder.args(software);
    expect(input).toEqual([]);
    expect(value(output, '-vf')).toMatch(/^subtitles=si=0,scale=-2:1080,format=(yuv420p|nv12)$/);
  });

  it('probes with a one-frame encode only when ffmpeg lists the codec', async () => {
    const run = vi.fn(async () => ({ code: 0, stdout: '', stderr: '' }));
    const missing: FfmpegBinary = { path: 'ffmpeg', version: '', encoders: new Set(), filters: new Set(), run };
    expect(await encoder.probe(missing)).toBe(false);
    expect(run).not.toHaveBeenCalled();
    const listed: FfmpegBinary = { ...missing, encoders: new Set([encoder.codec]) };
    expect(await encoder.probe(listed)).toBe(true);
    const [args] = run.mock.calls[0] as unknown as [string[]];
    expect(args).toEqual(expect.arrayContaining(['-frames:v', '1', '-c:v', encoder.codec]));
  });

  it('fails the probe when the test encode exits non-zero', async () => {
    const ffmpeg: FfmpegBinary = {
      path: 'ffmpeg', version: '', encoders: new Set([encoder.codec]), filters: new Set(),
      run: async () => ({ code: 1, stdout: '', stderr: 'No NVENC capable devices found' }),
    };
    expect(await encoder.probe(ffmpeg)).toBe(false);
  });
});

describe('hardware paths', () => {
  it('NVENC decodes and scales on CUDA', () => {
    const { input, output } = nvencEncoder.args(hardware);
    expect(input).toEqual(['-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda']);
    expect(value(output, '-vf')).toBe('scale_cuda=-2:1080:format=yuv420p');
  });

  it('QSV decodes and scales on Quick Sync', () => {
    const { input, output } = qsvEncoder.args(hardware);
    expect(input).toEqual(['-hwaccel', 'qsv', '-hwaccel_output_format', 'qsv']);
    expect(value(output, '-vf')).toBe('scale_qsv=w=-2:h=1080:format=nv12');
  });

  it('AMF decodes with D3D11VA (Windows only), scales on the CPU and forces IDR keyframes', () => {
    const { input, output } = amfEncoder.args(hardware);
    expect(input).toEqual(process.platform === 'win32' ? ['-hwaccel', 'd3d11va'] : []);
    expect(value(output, '-vf')).toBe('scale=-2:1080,format=nv12');
    expect(value(output, '-forced_idr')).toBe('1');
  });

  it('x264 uses the veryfast preset in 8-bit 4:2:0', () => {
    const { input, output } = x264Encoder.args(hardware);
    expect(input).toEqual([]);
    expect(value(output, '-preset')).toBe('veryfast');
    expect(value(output, '-vf')).toBe('scale=-2:1080,format=yuv420p');
  });
});
