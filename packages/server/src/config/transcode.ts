import { transcodeEncoderSchema, type TranscodeEncoder } from '@ottlib/shared';

/** Which video encoder the transcoder uses. `auto` = the first in registry order whose test encode passes. */
export type TranscodeEncoderSetting = TranscodeEncoder;
export const transcodeEncoderSettings: readonly TranscodeEncoderSetting[] = transcodeEncoderSchema.options;
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

/** Temp root for session folders (`<root>/<sessionId>`); default `os.tmpdir()/ottlib-hls`. */
export const transcodeDirEnvVar = 'OTTLIB_TRANSCODE_DIR';
export const transcodeDirName = 'ottlib-hls';
/** Lines of ffmpeg stderr kept for the error message when a session's ffmpeg fails. */
export const ffmpegStderrLines = 50;
/**
 * Every session's output timestamps are shifted by this much, so the first B-frames and the AAC priming of the film's start
 * (slightly negative) stay positive and every session, whatever segment it starts at, writes the same timeline.
 */
export const timelineOffsetSeconds = 10;
/**
 * A copy-mode restart seeks this far past the segment's keyframe (or to 1 ms before the next one, when closer): ffmpeg seeks
 * to the keyframe at or before the target, but backs off about 130 ms first for files with B-frames.
 */
export const copySeekLeadMs = 200;
/** A fragment whose start is within this of the next planned boundary opens that segment; earlier ones join the current one. */
export const boundaryToleranceMs = 100;
/** Embedded subtitles still being extracted answer 202 with this Retry-After. */
export const embeddedSubtitleRetryAfterSeconds = 2;
/** Embedded text subtitles are extracted to WebVTT under `<appData>/subtitles/embedded`. */
export const embeddedSubtitleDirName = 'embedded';
/** Extraction reads the whole file, so a big one on a slow disk may take minutes. */
export const embeddedSubtitleExtractTimeoutMs = 15 * 60_000;
/** A failed extraction is answered again from memory for this long (until the file changes) instead of re-running ffmpeg on every poll. */
export const embeddedSubtitleFailureMemoryMs = 60_000;
/** Text subtitle codecs (as the probe labels them, lower-cased) ffmpeg can convert to WebVTT. */
export const embeddedTextSubtitleCodecs: ReadonlySet<string> = new Set(['srt', 'subrip', 'ass', 'ssa', 'mov_text', 'webvtt', 'text']);
