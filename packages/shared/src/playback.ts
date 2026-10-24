import { z } from 'zod';

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

export const playbackSourceSchema = z.object({
  kind: z.enum(['direct']),
  streamUrl: z.string(),
  mimeType: z.string(),
  durationMs: z.number().int().nullable(),
  resumePositionMs: z.number().int().nonnegative().nullable(),
  subtitles: z.array(subtitleSourceSchema)
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

export type PlayLocalRequest = z.infer<typeof playLocalRequestSchema>;
export type PlaybackProgressUpdate =z.infer<typeof playbackProgressUpdateSchema>;
export type PlaybackProgressResult = z.infer<typeof playbackProgressResultSchema>;
export type SubtitleSource = z.infer<typeof subtitleSourceSchema>;
export type PlaybackSource = z.infer<typeof playbackSourceSchema>;
export type ServerInfo = z.infer<typeof serverInfoSchema>;
