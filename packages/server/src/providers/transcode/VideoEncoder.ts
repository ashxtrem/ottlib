import type { TranscodeEncoderSetting } from '../../config/transcode.js';
import type { FfmpegBinary } from './ffmpegLocator.js';

/**
 * What a transcode needs from the encoder. The command builder (ffmpegCommand.ts) composes:
 *   ffmpeg [...toneMap.inputArgs] [...encoder.input] -i <file> [...encoder.output] <audio args> <hls args>
 */
export interface EncodeOptions {
  /** Output height in pixels (width follows the aspect ratio, kept even). Already capped by the caller. */
  targetHeight: number;
  /** Target video bitrate; maxrate and bufsize are derived from it (`maxrateFactor`, `bufsizeFactor`). */
  bitrateKbps: number;
  /** Segment length: a keyframe is forced every `segmentSeconds` so each HLS segment starts on one. */
  segmentSeconds: number;
  /**
   * True when frames must be decoded into system memory: subtitle burn-in, CPU or OpenCL tone-mapping,
   * or a source codec the GPU cannot decode. The encoder then skips hardware decode and GPU scaling,
   * scales on the CPU and hands the encoder software frames.
   */
  softwareDecode: boolean;
  /**
   * Software filters run before the encoder's own scale step (e.g. a tone-map chain, `subtitles=`).
   * Non-empty implies `softwareDecode`.
   */
  filters?: string[];
}

export interface EncoderArgs {
  /** Placed before `-i`: hardware decode / device flags. */
  input: string[];
  /** Placed after `-i`: `-vf` chain (scale, format/upload), codec, bitrate, forced keyframes. Output is H.264 8-bit. */
  output: string[];
}

/** One H.264 encoder (NVENC, QSV, AMF, x264). One file each; registered in encoderRegistry.ts. */
export interface VideoEncoder {
  /** Setting value that forces this encoder. */
  name: Exclude<TranscodeEncoderSetting, 'auto'>;
  /** ffmpeg encoder name, e.g. `h264_nvenc`. */
  codec: string;
  /** True when ffmpeg lists the encoder and a one-frame test encode succeeds (GPU and driver present). */
  probe(ffmpeg: FfmpegBinary): Promise<boolean>;
  args(o: EncodeOptions): EncoderArgs;
}
