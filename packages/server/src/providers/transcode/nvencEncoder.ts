import { keyframeArgs, rateArgs, softwareFilterArgs, testEncode, usesSoftwareFrames } from './encoderArgs.js';
import type { VideoEncoder } from './VideoEncoder.js';

/**
 * NVIDIA NVENC. Hardware path: CUDA decode, frames stay on the GPU, `scale_cuda` scales and converts to 8-bit.
 * Software path: CPU frames go straight to `h264_nvenc` (it uploads them itself).
 */
export const nvencEncoder: VideoEncoder = {
  name: 'nvenc',
  codec: 'h264_nvenc',
  probe: (ffmpeg) => testEncode(ffmpeg, 'h264_nvenc', 'yuv420p'),
  args(o) {
    const software = usesSoftwareFrames(o);
    return {
      input: software ? [] : ['-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda'],
      output: [
        ...(software ? softwareFilterArgs(o, 'yuv420p') : ['-vf', `scale_cuda=-2:${o.targetHeight}:format=yuv420p`]),
        '-c:v', 'h264_nvenc', '-preset', 'p4', '-rc', 'vbr', '-profile:v', 'high', '-forced-idr', '1', '-no-scenecut', '1',
        ...rateArgs(o.bitrateKbps), ...keyframeArgs(o.segmentSeconds)
      ]
    };
  }
};
