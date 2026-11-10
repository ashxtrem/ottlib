import type { FfmpegBinary } from '../../../providers/transcode/ffmpegLocator.js';
import type { HealthCheck } from '../HealthCheck.js';

/**
 * Whether ffmpeg is available for the web player's transcoding. `FfmpegLocator.locate()` memoizes per process, so an
 * ffmpeg installed while the server runs shows up after a restart.
 */
export function ffmpegCheck(locate: () => Promise<FfmpegBinary | null>): HealthCheck {
  return {
    id: 'ffmpeg',
    label: 'ffmpeg',
    async run() {
      const binary = await locate();
      if (binary) return { state: 'ok', message: binary.version || `Found at ${binary.path}.` };
      return {
        state: 'warn',
        message: 'ffmpeg was not found, so transcoding is off: the browser plays only files it supports directly.',
        fix: 'Install FFmpeg and put it on the PATH (or set FFMPEG_PATH), then restart OttLib.'
      };
    }
  };
}
