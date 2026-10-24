import type { TranscodeEncoder, TranscodeEncoders } from '@ottlib/shared';
import type { EncoderRegistry } from '../providers/transcode/encoderRegistry.js';
import type { FfmpegBinary } from '../providers/transcode/ffmpegLocator.js';

/** What the server's ffmpeg can transcode with (GET /api/transcode/encoders). */
export class TranscodeInfoService {
  public constructor(
    private readonly locate: () => Promise<FfmpegBinary | null>,
    private readonly encoders: (ffmpeg: FfmpegBinary) => EncoderRegistry,
    private readonly setting: () => TranscodeEncoder
  ) {}

  public async get(): Promise<TranscodeEncoders> {
    const ffmpeg = await this.locate();
    if (!ffmpeg) return { available: false, ffmpegVersion: null, encoders: [], active: null };
    const registry = this.encoders(ffmpeg);
    const [available, active] = await Promise.all([registry.available(), registry.pick(this.setting())]);
    return { available: true, ffmpegVersion: ffmpeg.version || null, encoders: available.map((encoder) => encoder.name), active: active?.name ?? null };
  }
}
