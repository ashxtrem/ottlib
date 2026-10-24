import { describe, expect, it, vi } from 'vitest';
import { EncoderRegistry, videoEncoders } from './encoderRegistry.js';
import type { FfmpegBinary } from './ffmpegLocator.js';
import type { VideoEncoder } from './VideoEncoder.js';

const ffmpeg: FfmpegBinary = {
  path: 'ffmpeg', version: 'ffmpeg version test', encoders: new Set(), filters: new Set(),
  run: async () => ({ code: 0, stdout: '', stderr: '' }),
};

function fake(name: VideoEncoder['name'], works: boolean | 'throw'): VideoEncoder {
  return {
    name, codec: `codec_${name}`,
    probe: vi.fn(async () => { if (works === 'throw') throw new Error('boom'); return works; }),
    args: () => ({ input: [], output: [] }),
  };
}

describe('videoEncoders', () => {
  it('orders NVENC, QSV, AMF, x264', () => {
    expect(videoEncoders.map((encoder) => encoder.name)).toEqual(['nvenc', 'qsv', 'amf', 'x264']);
    expect(videoEncoders.map((encoder) => encoder.codec)).toEqual(['h264_nvenc', 'h264_qsv', 'h264_amf', 'libx264']);
  });
});

describe('EncoderRegistry', () => {
  it('auto picks the first encoder whose probe passes, in order', async () => {
    const list = [fake('nvenc', false), fake('qsv', 'throw'), fake('amf', true), fake('x264', true)];
    const registry = new EncoderRegistry(ffmpeg, list, () => {});
    expect((await registry.pick('auto'))?.name).toBe('amf');
    expect(list[3].probe).not.toHaveBeenCalled();
  });

  it('uses a forced encoder when it works', async () => {
    const list = [fake('nvenc', true), fake('qsv', true), fake('amf', true), fake('x264', true)];
    const registry = new EncoderRegistry(ffmpeg, list, () => {});
    expect((await registry.pick('x264'))?.name).toBe('x264');
    expect(list[0].probe).not.toHaveBeenCalled();
  });

  it('falls back to auto with a log line when the forced encoder fails', async () => {
    const log = vi.fn();
    const list = [fake('nvenc', false), fake('qsv', true), fake('amf', false), fake('x264', true)];
    const registry = new EncoderRegistry(ffmpeg, list, log);
    expect((await registry.pick('amf'))?.name).toBe('qsv');
    expect(log).toHaveBeenCalledWith(expect.stringContaining('"amf"'));
  });

  it('probes each encoder once', async () => {
    const list = [fake('nvenc', false), fake('qsv', false), fake('amf', false), fake('x264', true)];
    const registry = new EncoderRegistry(ffmpeg, list, () => {});
    await registry.pick('auto');
    await registry.pick('auto');
    await registry.pick('nvenc');
    for (const encoder of list) expect(encoder.probe).toHaveBeenCalledTimes(1);
  });

  it('returns null when nothing works', async () => {
    const registry = new EncoderRegistry(ffmpeg, [fake('nvenc', false), fake('x264', false)], () => {});
    expect(await registry.pick('auto')).toBeNull();
  });
});
