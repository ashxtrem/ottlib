import { z } from 'zod';

export const torrentQualitySchema = z.object({
  resolution: z.string().nullable(),
  source: z.string().nullable(),
  codec: z.string().nullable(),
  group: z.string().nullable()
});

export const torrentLibraryStatusSchema = z.enum(['owned', 'missing', 'new']);

export const torrentPreferredResolutionSchema = z.enum(['2160p', '1080p', '720p']);
export const torrentPreferredCodecSchema = z.enum(['hevc', 'h264', 'av1']);

export const torrentResultSchema = z.object({
  fileName: z.string(),
  fileSize: z.number().nonnegative().nullable(),
  fileUrl: z.string(),
  nbSeeders: z.number().int().nullable(),
  nbLeechers: z.number().int().nullable(),
  siteUrl: z.string().nullable(),
  descrLink: z.string().nullable(),
  engines: z.array(z.string()),
  publishedAt: z.string().nullable(),
  quality: torrentQualitySchema,
  /** 0-100 match against the preferred resolution, codec and size cap in Settings; null while none is set. */
  score: z.number().min(0).max(100).nullable(),
  /** True on the single top-scoring result (score above 0). */
  bestMatch: z.boolean(),
  libraryStatus: torrentLibraryStatusSchema
});

export const torrentSearchStatusSchema = z.enum(['running', 'stopped', 'not-configured', 'unreachable']);

export const torrentSearchStartSchema = z.object({
  q: z.string().trim().min(1).max(300),
  year: z.number().int().min(1880).max(3000).optional()
});

export const torrentSearchResponseSchema = z.object({
  searchId: z.string().optional(),
  status: torrentSearchStatusSchema
});

export const torrentSearchStateSchema = z.object({
  searchId: z.string(),
  status: torrentSearchStatusSchema,
  total: z.number().int().nonnegative(),
  results: z.array(torrentResultSchema),
  error: z.string().optional()
});

export const sendTorrentRequestSchema = z.object({
  url: z.string().trim().min(1).max(10_000),
  movieId: z.number().int().positive().optional()
});

export const torrentConnectionStatusSchema = z.object({
  configured: z.boolean(),
  status: z.enum(['not-configured', 'untested', 'connected', 'plugins-missing', 'unreachable', 'login-rejected', 'ip-banned']),
  message: z.string(),
  plugins: z.array(z.object({ name: z.string(), enabled: z.boolean() }))
});

export const torrentDownloadSchema = z.object({
  hash: z.string(),
  name: z.string(),
  state: z.string(),
  progress: z.number().min(0).max(1),
  downloadedBytes: z.number().nonnegative(),
  totalBytes: z.number().nonnegative(),
  downloadSpeed: z.number().nonnegative(),
  etaSeconds: z.number().int().nonnegative().nullable(),
  seeds: z.number().int().nonnegative().nullable(),
  peers: z.number().int().nonnegative().nullable(),
  savePath: z.string().nullable(),
  error: z.string().nullable()
});

export const activeTorrentDownloadsSchema = z.object({
  status: z.enum(['ok', 'not-configured', 'unreachable', 'login-rejected', 'ip-banned', 'error']),
  message: z.string().optional(),
  torrents: z.array(torrentDownloadSchema)
});

export type TorrentQuality = z.infer<typeof torrentQualitySchema>;
export type TorrentPreferredResolution = z.infer<typeof torrentPreferredResolutionSchema>;
export type TorrentPreferredCodec = z.infer<typeof torrentPreferredCodecSchema>;
export type TorrentLibraryStatus = z.infer<typeof torrentLibraryStatusSchema>;
export type TorrentResult = z.infer<typeof torrentResultSchema>;
export type TorrentSearchStatus = z.infer<typeof torrentSearchStatusSchema>;
export type TorrentSearchState = z.infer<typeof torrentSearchStateSchema>;
export type SendTorrentRequest = z.infer<typeof sendTorrentRequestSchema>;
export type TorrentConnectionStatus = z.infer<typeof torrentConnectionStatusSchema>;
export type TorrentDownload = z.infer<typeof torrentDownloadSchema>;
export type ActiveTorrentDownloads = z.infer<typeof activeTorrentDownloadsSchema>;
