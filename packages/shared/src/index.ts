import { z } from 'zod';
export * from './torrent.js';

const languageNames: Record<string, string> = {
  en: 'English', eng: 'English', hi: 'Hindi', hin: 'Hindi', ta: 'Tamil', tam: 'Tamil', te: 'Telugu', tel: 'Telugu', ml: 'Malayalam', mal: 'Malayalam',
  bn: 'Bengali', ben: 'Bengali', de: 'German', deu: 'German', es: 'Spanish', spa: 'Spanish', fr: 'French', fra: 'French', it: 'Italian', ita: 'Italian',
  ja: 'Japanese', jpn: 'Japanese', ko: 'Korean', kor: 'Korean', pt: 'Portuguese', por: 'Portuguese', ru: 'Russian', rus: 'Russian', zh: 'Chinese', zho: 'Chinese'
};

export function formatRuntime(runtimeMinutes: number | null | undefined, durationMs: number | null | undefined = null): string | null {
  const minutes = Number.isFinite(runtimeMinutes) && runtimeMinutes! > 0
    ? Math.round(runtimeMinutes!)
    : Number.isFinite(durationMs) && durationMs! > 0 ? Math.max(1, Math.round(durationMs! / 60_000)) : null;
  if (minutes === null) return null;
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

export function formatResolution(height: number | null | undefined): string | null {
  if (!Number.isFinite(height) || height! <= 0) return null;
  if (height! >= 2160) return '4K';
  if (height! >= 1440) return '1440p';
  if (height! >= 1080) return '1080p';
  if (height! >= 720) return '720p';
  return `${height}p`;
}

export function formatBytes(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return '—';
  const bytes: number = value;
  const units = ['B', 'KB', 'MB', 'GB', 'TB']; const index = Math.min(Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
}

export function formatMediaLanguage(language: string | null | undefined): string {
  const normalized = language?.trim().toLowerCase();
  return normalized ? languageNames[normalized] ?? normalized.toUpperCase() : 'Unknown';
}

export const videoExtensions = ['mp4', 'mkv', 'avi', 'mov', 'm4v', 'wmv', 'flv', 'webm'] as const;
export const deviceIdSchema = z.string().uuid();

export const shelfMembershipSchema = z.object({
  id: z.number().int(),
  name: z.string()
});

export const mediaTrackSchema = z.object({
  type: z.enum(['audio', 'subtitle']),
  source: z.enum(['embedded', 'external']),
  order: z.number().int().nonnegative(),
  language: z.string().nullable(),
  title: z.string().nullable(),
  codec: z.string().nullable(),
  channels: z.number().int().nullable(),
  channelLayout: z.string().nullable(),
  isDefault: z.boolean(),
  isForced: z.boolean(),
  isHearingImpaired: z.boolean()
});

export const mediaInfoSchema = z.object({
  container: z.string().nullable(),
  durationMs: z.number().int().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  videoCodec: z.string().nullable(),
  videoProfile: z.string().nullable(),
  videoBitRate: z.number().int().nullable(),
  hdrFormat: z.string().nullable(),
  tracks: z.array(mediaTrackSchema)
});

export const movieSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  year: z.number().int().nullable(),
  rawFilename: z.string(),
  filePath: z.string(),
  titleOverride: z.string().nullable(),
  overview: z.string().nullable(),
  posterUrl: z.string().nullable(),
  backdropUrl: z.string().nullable(),
  genres: z.array(z.string()),
  cast: z.array(z.string()),
  rating: z.number().nullable(),
  runtime: z.number().int().nullable(),
  imdbId: z.string().nullable(),
  metadataStatus: z.enum(['pending', 'suggested', 'matched', 'unmatched', 'error']),
  metadataSource: z.string().nullable(),
  mediaType: z.enum(['movie', 'tv']).nullable(),
  season: z.number().int().positive().nullable(),
  episode: z.number().int().positive().nullable(),
  fileSizeBytes: z.number().int().nonnegative(),
  mediaInfo: mediaInfoSchema.nullable(),
  watched: z.boolean(),
  missing: z.boolean(),
  addedAt: z.string(),
  shelves: z.array(shelfMembershipSchema)
});

export const movieListItemSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  year: z.number().int().nullable(),
  posterUrl: z.string().nullable(),
  resolution: z.string().nullable(),
  hdrFormat: z.string().nullable(),
  watched: z.boolean(),
  missing: z.boolean(),
  metadataStatus: z.enum(['pending', 'suggested', 'matched', 'unmatched', 'error']),
  shelves: z.array(shelfMembershipSchema)
});

export const movieListPageSchema = z.object({
  items: z.array(movieListItemSchema),
  nextCursor: z.string().nullable(),
  total: z.number().int().nonnegative()
});

export const folderSchema = z.object({
  id: z.number().int(),
  path: z.string(),
  enabled: z.boolean(),
  createdAt: z.string()
});

export const scanRunSchema = z.object({
  id: z.number().int(),
  kind: z.enum(['scan', 'auto-accept', 'metadata-refresh', 'metadata-type-backfill']),
  status: z.enum(['running', 'completed', 'failed']),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  filesFound: z.number().int(),
  filesProcessed: z.number().int(),
  titlesAdded: z.number().int(),
  errorSummary: z.string().nullable()
});

export const settingsSchema = z.object({
  tmdbApiKey: z.string(),
  omdbApiKey: z.string(),
  qbittorrentUrl: z.string(),
  qbittorrentUsername: z.string(),
  qbittorrentPassword: z.string(),
  qbittorrentCategory: z.string(),
  qbittorrentSavePath: z.string(),
  extensions: z.array(z.string()),
  ignoredPatterns: z.array(z.string()),
  excludedFolders: z.array(z.string()),
  scheduleEnabled: z.boolean(),
  scheduleCron: z.string()
});

export const updateSettingsSchema = settingsSchema.partial();
export const testTmdbKeySchema = z.object({ tmdbApiKey: z.string().trim().optional() });
export const scheduleValidationRequestSchema = z.object({ scheduleCron: z.string().trim().min(1) });
export const scheduleValidationResultSchema = z.object({ valid: z.boolean(), nextRun: z.string().datetime().optional(), error: z.string().optional() });
export const createFolderSchema = z.object({ path: z.string().min(1) });
export const moviePatchSchema = z.object({ titleOverride: z.string().trim().min(1).nullable() });
export const imdbLookupSchema = z.object({ imdbId: z.string().trim().min(1) });
export const rematchSchema = z.object({ title: z.string().trim().min(1).optional() });
export const metadataRefreshSchema = z.object({ movieIds: z.array(z.number().int().positive()).min(1).optional() });
export const watchStateSchema = z.object({ watched: z.boolean() });
export const movieFilterOptionsSchema = z.object({
  genres: z.array(z.string()),
  actors: z.array(z.string()),
  resolutions: z.array(z.string()),
  audioLanguages: z.array(z.string())
});
export const shelfNameSchema = z.string().trim().min(1).max(100);
export const shelfCreateSchema = z.object({ name: shelfNameSchema, movieIds: z.array(z.number().int().positive()).min(0) });
export const shelfRenameSchema = z.object({ name: shelfNameSchema });
export const shelfMovieIdsSchema = z.object({ movieIds: z.array(z.number().int().positive()).min(1) });
export const shelfOrderSchema = z.object({ movieIds: z.array(z.number().int().positive()) });
export const movieShelfMembershipUpdateSchema = z.object({
  shelfIds: z.array(z.number().int().positive()),
  newShelfName: shelfNameSchema.optional()
});

export const matchCandidateSchema = z.object({
  id: z.number().int(),
  provider: z.string(),
  providerId: z.string(),
  title: z.string(),
  year: z.number().int().nullable(),
  score: z.number(),
  mediaType: z.enum(['movie', 'tv']),
  season: z.number().int().positive().optional(),
  episode: z.number().int().positive().optional()
});
export const manualMatchCandidateSchema = matchCandidateSchema.omit({ id: true });
export const acceptManualCandidateSchema = z.object({
  candidate: manualMatchCandidateSchema.pick({ provider: true, providerId: true, mediaType: true, season: true, episode: true }),
  season: z.number().int().positive().optional(),
  episode: z.number().int().positive().optional()
});
export const acceptCandidateSchema = z.object({ season: z.number().int().positive().optional(), episode: z.number().int().positive().optional() });
export const autoAcceptBackfillStatusSchema = z.object({ eligible: z.number().int().nonnegative() });

export const shelfCoverMovieSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  posterUrl: z.string().nullable()
});
export const shelfSummarySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  movieCount: z.number().int().nonnegative(),
  coverMovies: z.array(shelfCoverMovieSchema),
  createdAt: z.string(),
  updatedAt: z.string()
});
export const shelfDetailSchema = shelfSummarySchema.extend({ movies: z.array(movieSchema) });

export type Movie = z.infer<typeof movieSchema>;
export type MovieListItem = z.infer<typeof movieListItemSchema>;
export type MovieListPage = z.infer<typeof movieListPageSchema>;
export type MediaInfo = z.infer<typeof mediaInfoSchema>;
export type MediaTrack = z.infer<typeof mediaTrackSchema>;
export type ShelfMembership = z.infer<typeof shelfMembershipSchema>;
export type Folder = z.infer<typeof folderSchema>;
export type ScanRun = z.infer<typeof scanRunSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type UpdateSettings = z.infer<typeof updateSettingsSchema>;
export type ScheduleValidationResult = z.infer<typeof scheduleValidationResultSchema>;
export type MatchCandidate = z.infer<typeof matchCandidateSchema>;
export type ManualMatchCandidate = z.infer<typeof manualMatchCandidateSchema>;
export type AutoAcceptBackfillStatus = z.infer<typeof autoAcceptBackfillStatusSchema>;
export type MovieFilterOptions = z.infer<typeof movieFilterOptionsSchema>;
export type ShelfCoverMovie = z.infer<typeof shelfCoverMovieSchema>;
export type ShelfSummary = z.infer<typeof shelfSummarySchema>;
export type ShelfDetail = z.infer<typeof shelfDetailSchema>;
