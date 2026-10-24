import type { TranscodeEncoderSetting } from '../../config/transcode.js';
import { amfEncoder } from './amfEncoder.js';
import type { FfmpegBinary } from './ffmpegLocator.js';
import { nvencEncoder } from './nvencEncoder.js';
import { qsvEncoder } from './qsvEncoder.js';
import type { VideoEncoder } from './VideoEncoder.js';
import { x264Encoder } from './x264Encoder.js';

/** Tried in this order for `auto`: GPUs first, then the CPU. A new encoder is one file plus one entry here. */
export const videoEncoders: readonly VideoEncoder[] = [nvencEncoder, qsvEncoder, amfEncoder, x264Encoder];

/** Picks the encoder for the `transcodeEncoder` setting. Each encoder is probed at most once per registry. */
export class EncoderRegistry {
  private readonly probes = new Map<string, Promise<boolean>>();

  public constructor(
    private readonly ffmpeg: FfmpegBinary,
    private readonly encoders: readonly VideoEncoder[] = videoEncoders,
    private readonly log: (message: string) => void = (message) => console.warn(message)
  ) {}

  /** `auto` = first encoder whose probe passes; a forced encoder that fails falls back to `auto`. Null when none work. */
  public async pick(setting: TranscodeEncoderSetting): Promise<VideoEncoder | null> {
    if (setting !== 'auto') {
      const forced = this.encoders.find((encoder) => encoder.name === setting);
      if (forced && await this.works(forced)) return forced;
      this.log(`Transcode encoder "${setting}" is not available; falling back to auto`);
    }
    for (const encoder of this.encoders) {
      if (await this.works(encoder)) return encoder;
    }
    return null;
  }

  /** Every registered encoder whose probe passes, in registry order. */
  public async available(): Promise<VideoEncoder[]> {
    const results = await Promise.all(this.encoders.map((encoder) => this.works(encoder)));
    return this.encoders.filter((_encoder, index) => results[index]);
  }

  private works(encoder: VideoEncoder): Promise<boolean> {
    let result = this.probes.get(encoder.name);
    if (!result) {
      result = encoder.probe(this.ffmpeg).catch(() => false);
      this.probes.set(encoder.name, result);
    }
    return result;
  }
}
