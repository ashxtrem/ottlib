import { z } from 'zod';
import { creditsSchema } from './credits.js';

/** Bumped when a change to the endpoints native clients use is not backwards compatible. */
export const apiVersion = 1;

export const playbackProgressUpdateSchema = z.object({
  positionMs: z.number().int().nonnegative(),
  shelfId: z.number().int().positive().optional(),
  durationMs: z.number().int().positive()
});

export const playbackProgressResultSchema = z.object({
  resumePositionMs: z.number().int().nonnegative().nullable(),
  watched: z.boolean()
});

export const subtitleSourceSchema = z.object({
  url: z.string(),
  language: z.string().nullable(),
  codec: z.string().nullable(),
  title: z.string().nullable(),
  isForced: z.boolean(),
  isHearingImpaired: z.boolean()
});

/** One audio track a client can pick; `order` is the ffprobe stream index (what `audioOrder` takes). */
export const audioTrackSourceSchema = z.object({
  order: z.number().int().nonnegative(),
  language: z.string().nullable(),
  title: z.string().nullable(),
  codec: z.string().nullable(),
  channels: z.number().int().nullable(),
  isDefault: z.boolean()
});

/** A picture-based subtitle that can only be shown by burning it into the video. */
export const burnInSubtitleSchema = z.object({
  order: z.number().int().nonnegative(),
  language: z.string().nullable(),
  title: z.string().nullable(),
  codec: z.string().nullable(),
  isForced: z.boolean()
});

/** The real picture inside the frame (letterbox bars excluded), as fractions of the frame width and height. */
export const pictureAreaSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1)
});

export const playbackModeSchema = z.enum(['direct', 'remux', 'transcode']);

export const playbackSourceSchema = z.object({
  kind: z.enum(['direct', 'hls']),
  /** For `hls` the playlist URL. */
  streamUrl: z.string(),
  mimeType: z.string(),
  durationMs: z.number().int().nullable(),
  resumePositionMs: z.number().int().nonnegative().nullable(),
  subtitles: z.array(subtitleSourceSchema),
  mode: playbackModeSchema.optional(),
  /** Why the file is not played directly (e.g. `video-codec`, `audio-codec`, `container`). */
  reasons: z.array(z.string()).optional(),
  /** DELETE this URL to stop the transcode session. */
  sessionUrl: z.string().optional(),
  audioTracks: z.array(audioTrackSourceSchema).optional(),
  audioOrder: z.number().int().nonnegative().optional(),
  burnInSubtitles: z.array(burnInSubtitleSchema).optional(),
  burnSubtitleOrder: z.number().int().nonnegative().optional(),
  /** Detected picture area; null when unknown or when burned-in subtitles sit in the bars. */
  pictureArea: pictureAreaSchema.nullable().optional(),
  /** Where the end credits start; null when no mark, chapter or sibling episode tells. */
  credits: creditsSchema.nullable(),
  /** Whether this profile skips the credits of this title (its override, else its default for the media type). */
  autoSkipCredits: z.boolean(),
  /** Server-relative frame-preview URL; it always carries a query string, so the client appends `&t=<ms>`. */
  framePreviewUrl: z.string()
});

const commaList = z
  .union([z.string(), z.array(z.string())])
  .transform((value) =>
    (Array.isArray(value) ? value.join(',') : value)
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter((item) => item.length > 0)
  );

const queryBool = z
  .union([z.boolean(), z.string()])
  .transform((value, ctx) => {
    if (typeof value === 'boolean') return value;
    const text = value.trim().toLowerCase();
    if (text === 'true' || text === '1') return true;
    if (text === 'false' || text === '0') return false;
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Expected true, false, 1 or 0' });
    return z.NEVER;
  });

/**
 * Query of GET /api/movies/:id/playback. Its presence (any field) turns the direct/remux/transcode decision on;
 * without it the answer is the plain direct source. Lists are comma separated.
 */
export const playbackRequestSchema = z.object({
  containers: commaList.optional(),
  video: commaList.optional(),
  audio: commaList.optional(),
  hdr: queryBool.optional(),
  maxHeight: z.coerce.number().int().nonnegative().optional(),
  audioOrder: z.coerce.number().int().nonnegative().optional(),
  burnSubtitleOrder: z.coerce.number().int().nonnegative().optional(),
  startMs: z.coerce.number().int().nonnegative().optional()
});

export const serverInfoSchema = z.object({
  name: z.string(),
  version: z.string(),
  apiVersion: z.number().int().positive(),
  port: z.number().int(),
  addresses: z.array(z.string()),
  /** True when an access PIN is set: clients must sign in before anything but this endpoint answers. */
  authRequired: z.boolean()
});

/** Optional body of POST /api/movies/:id/play-local. */
export const playLocalRequestSchema = z.object({
  startSec: z.number().int().nonnegative().optional(),
  /** Fail with 409 VLC_NOT_FOUND instead of falling back to the OS default player. */
  requireVlc: z.boolean().optional()
});

/** Query of GET /api/stream/:id/playlist.m3u. A bad `start` is ignored (0) rather than failing the download. */
export const playlistQuerySchema = z.object({
  start: z.coerce.number().int().nonnegative().catch(0).default(0)
});

/** GET /api/transcode/encoders: what the server's ffmpeg can transcode with. `available: false` when there is no ffmpeg. */
export const transcodeEncodersSchema = z.object({
  available: z.boolean(),
  ffmpegVersion: z.string().nullable(),
  /** Encoders whose test encode passed (`nvenc`, `qsv`, `amf`, `x264`), in the order `auto` tries them. */
  encoders: z.array(z.string()),
  /** The encoder the current setting resolves to, or null when none works. */
  active: z.string().nullable()
});

export type TranscodeEncoders = z.infer<typeof transcodeEncodersSchema>;
export type PlayLocalRequest = z.infer<typeof playLocalRequestSchema>;
export type PlaybackProgressUpdate = z.infer<typeof playbackProgressUpdateSchema>;
export type PlaybackProgressResult = z.infer<typeof playbackProgressResultSchema>;
export type SubtitleSource = z.infer<typeof subtitleSourceSchema>;
export type PictureArea = z.infer<typeof pictureAreaSchema>;
export type PlaybackSource = z.infer<typeof playbackSourceSchema>;
export type PlaybackMode = z.infer<typeof playbackModeSchema>;
export type AudioTrackSource = z.infer<typeof audioTrackSourceSchema>;
export type BurnInSubtitle = z.infer<typeof burnInSubtitleSchema>;
export type PlaybackRequest = z.infer<typeof playbackRequestSchema>;
export type ServerInfo = z.infer<typeof serverInfoSchema>;
