import { keyframeArgs, rateArgs, softwareFilterArgs, testEncode, usesSoftwareFrames } from './encoderArgs.js';
import type { VideoEncoder } from './VideoEncoder.js';

/**
 * Intel Quick Sync. Hardware path: QSV decode, `scale_qsv` scales and converts to nv12 on the GPU.
 * Software path: CPU nv12 frames go to `h264_qsv`, which uploads them.
 */
export const qsvEncoder: VideoEncoder = {
  name: 'qsv',
  codec: 'h264_qsv',
  probe: (ffmpeg) => testEncode(ffmpeg, 'h264_qsv', 'nv12'),
  args(o) {
    const software = usesSoftwareFrames(o);
    return {
      input: software ? [] : ['-hwaccel', 'qsv', '-hwaccel_output_format', 'qsv'],
      output: [
        ...(software ? softwareFilterArgs(o, 'nv12') : ['-vf', `scale_qsv=w=-2:h=${o.targetHeight}:format=nv12`]),
        '-c:v', 'h264_qsv', '-preset', 'veryfast', '-profile:v', 'high', '-forced_idr', '1',
        ...rateArgs(o.bitrateKbps), ...keyframeArgs(o.segmentSeconds)
      ]
    };
  }
};
