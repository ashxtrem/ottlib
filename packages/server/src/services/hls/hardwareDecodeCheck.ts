import { ffmpegTimeouts } from '../../config/transcode.js';
import type { FfmpegBinary } from '../../providers/transcode/ffmpegLocator.js';
import type { VideoEncoder } from '../../providers/transcode/VideoEncoder.js';

/**
 * Whether an encoder's hardware path (GPU decode → GPU scale → encode) works for a source codec. The encoder probe only
 * encodes software frames, and some driver/build pairs crash on GPU-resident frames, so the first transcode of each
 * encoder + codec pair encodes a few frames of the real file that way; the answer is cached.
 */
export class HardwareDecodeCheck {
  private readonly results = new Map<string, Promise<boolean>>();

  public constructor(private readonly log: (message: string) => void = () => undefined) {}

  public works(ffmpeg: FfmpegBinary, encoder: VideoEncoder, inputPath: string, codec: string | null): Promise<boolean> {
    const probe = encoder.args({ targetHeight: 360, bitrateKbps: 1_000, segmentSeconds: 4, softwareDecode: false });
    if (probe.input.length === 0) return Promise.resolve(true);
    const key = `${ffmpeg.path}|${encoder.name}|${codec?.toLowerCase() ?? '?'}`;
    let result = this.results.get(key);
    if (!result) {
      result = ffmpeg.run(['-hide_banner', '-nostdin', '-v', 'error', ...probe.input, '-i', inputPath, '-map', '0:v:0', ...probe.output, '-frames:v', '3', '-an', '-f', 'null', '-'], ffmpegTimeouts.probeEncodeMs)
        .then((outcome) => outcome.code === 0, () => false)
        .then((ok) => { if (!ok) this.log(`${encoder.name}: GPU decode fails for ${codec ?? 'this codec'}; decoding on the CPU instead`); return ok; });
      this.results.set(key, result);
    }
    return result;
  }
}
