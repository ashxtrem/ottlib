import { keyframeArgs, rateArgs, softwareFilterArgs, testEncode } from './encoderArgs.js';
import type { VideoEncoder } from './VideoEncoder.js';

/** libx264 on the CPU: the fallback that works everywhere ffmpeg is built with it. Always software frames. */
export const x264Encoder: VideoEncoder = {
  name: 'x264',
  codec: 'libx264',
  probe: (ffmpeg) => testEncode(ffmpeg, 'libx264', 'yuv420p'),
  args(o) {
    return {
      input: [],
      output: [
        ...softwareFilterArgs(o, 'yuv420p'),
        '-c:v', 'libx264', '-preset', 'veryfast', '-profile:v', 'high', '-sc_threshold', '0',
        ...rateArgs(o.bitrateKbps), ...keyframeArgs(o.segmentSeconds)
      ]
    };
  }
};
