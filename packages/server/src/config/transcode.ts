/** Which video encoder the transcoder uses. `auto` = the first in registry order whose test encode passes. */
export type TranscodeEncoderSetting = 'auto' | 'nvenc' | 'qsv' | 'amf' | 'x264';
export const transcodeEncoderSettings: readonly TranscodeEncoderSetting[] = ['auto', 'nvenc', 'qsv', 'amf', 'x264'];
export const defaultTranscodeEncoder: TranscodeEncoderSetting = 'auto';

/** ffmpeg binary: `FFMPEG_PATH`, else `ffmpeg` on PATH (mirrors FFPROBE_PATH). */
export const ffmpegEnvVar = 'FFMPEG_PATH';
export const ffmpegDefaultCommand = 'ffmpeg';

export const ffmpegTimeouts = {
  /** `-version`, `-encoders`, `-filters`. */
  infoMs: 10_000,
  /** One-frame test encode per encoder. */
  probeEncodeMs: 15_000,
  /** Cap on captured stdout/stderr of the info commands. */
  maxOutputBytes: 2_000_000,
};

/** Source resolution is kept, capped here (or at the client's `maxHeight`). */
export const maxTranscodeHeight = 2160;

/** Target video bitrate by output height: the first row whose `minHeight` the output reaches. Actual = min(source, ladder). */
export const bitrateLadderKbps: readonly { minHeight: number; kbps: number }[] = [
  { minHeight: 2160, kbps: 30_000 },
  { minHeight: 1440, kbps: 20_000 },
  { minHeight: 1080, kbps: 12_000 },
  { minHeight: 720, kbps: 6_000 },
  { minHeight: 0, kbps: 4_000 },
];
export const maxrateFactor = 1.5;
export const bufsizeFactor = 2;

/** Audio is copied when the client plays the codec; otherwise AAC at these bitrates (7.1 is downmixed to 5.1). */
export const audioTranscode = {
  codec: 'aac',
  stereoKbps: 192,
  surroundKbps: 384,
  maxChannels: 6,
};

/** CPU tone-mapping (zscale + tonemap) is scaled to at most this height so it stays real-time. */
export const cpuToneMapMaxHeight = 1080;

export const transcodeSessionLimits = {
  maxTranscodeSessions: 3,
  maxRemuxSessions: 6,
  idleTimeoutMs: 45_000,
  sweepIntervalMs: 10_000,
  /** Segments further than this behind the newest requested one are deleted. */
  deleteSegmentsBehind: 30,
  /** ffmpeg is stopped when it runs this many segments ahead of the player... */
  stopAheadSegments: 150,
  /** ...and restarted once the player comes within this many segments of where it stopped. */
  restartWithinSegments: 30,
  segmentWaitMs: 20_000,
  /** How far past the newest produced segment a request may be and still wait. */
  segmentWaitWindow: 4,
};

/** Transcode segment length; also drives forced keyframes (`-force_key_frames expr:gte(t,n_forced*4)`). */
export const transcodeSegmentSeconds = 4;
/** Remux of a Matroska file with an average Cue gap above this falls back to fixed-length segments. */
export const maxAverageCueGapSeconds = 10;
export const keyframeCacheSize = 50;
/** Embedded subtitles still being extracted answer 503 with this Retry-After. */
export const embeddedSubtitleRetryAfterSeconds = 2;
