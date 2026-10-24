import { keyframeArgs, rateArgs, softwareFilterArgs, testEncode, usesSoftwareFrames } from './encoderArgs.js';
import type { VideoEncoder } from './VideoEncoder.js';

/**
 * AMD AMF. Hardware path decodes with D3D11VA (frames come back to system memory, so scaling is on the CPU);
 * `h264_amf` uploads nv12 frames itself.
 */
export const amfEncoder: VideoEncoder = {
  name: 'amf',
  codec: 'h264_amf',
  probe: (ffmpeg) => testEncode(ffmpeg, 'h264_amf', 'nv12'),
  args(o) {
    return {
      // D3D11VA exists only on Windows; elsewhere AMF gets CPU-decoded frames.
      input: usesSoftwareFrames(o) || process.platform !== 'win32' ? [] : ['-hwaccel', 'd3d11va'],
      output: [
        ...softwareFilterArgs(o, 'nv12'),
        '-c:v', 'h264_amf', '-usage', 'transcoding', '-quality', 'speed', '-rc', 'vbr_peak', '-profile:v', 'high', '-forced_idr', '1',
        ...rateArgs(o.bitrateKbps), ...keyframeArgs(o.segmentSeconds)
      ]
    };
  }
};
