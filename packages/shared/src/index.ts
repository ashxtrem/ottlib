import { z } from 'zod';

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
  mediaInfo: mediaInfoSchema.nullable(),
  watched: z.boolean(),
  missing: z.boolean(),
  addedAt: z.string(),
  shelves: z.array(shelfMembershipSchema)
});

export const folderSchema = z.object({
  id: z.number().int(),
  path: z.string(),
  enabled: z.boolean(),
  createdAt: z.string()
});

export const scanRunSchema = z.object({
  id: z.number().int(),
  status: z.enum(['running', 'completed', 'failed']),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  filesFound: z.number().int(),
  filesProcessed: z.number().int(),
  errorSummary: z.string().nullable()
});

export const settingsSchema = z.object({
  tmdbApiKey: z.string(),
  omdbApiKey: z.string(),
  extensions: z.array(z.string()),
  ignoredPatterns: z.array(z.string()),
  excludedFolders: z.array(z.string()),
  scheduleEnabled: z.boolean(),
  scheduleCron: z.string()
});

export const updateSettingsSchema = settingsSchema.partial();
export const createFolderSchema = z.object({ path: z.string().min(1) });
export const moviePatchSchema = z.object({ titleOverride: z.string().trim().min(1).nullable() });
export const imdbLookupSchema = z.object({ imdbId: z.string().trim().min(1) });
export const rematchSchema = z.object({ title: z.string().trim().min(1).optional() });
export const watchStateSchema = z.object({ watched: z.boolean() });
export const movieFilterOptionsSchema = z.object({ genres: z.array(z.string()), actors: z.array(z.string()) });
export const shelfNameSchema = z.string().trim().min(1).max(100);
export const shelfCreateSchema = z.object({ name: shelfNameSchema, movieIds: z.array(z.number().int().positive()).min(1) });
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
  mediaType: z.enum(['movie', 'tv'])
});
export const acceptCandidateSchema = z.object({ season: z.number().int().positive().optional(), episode: z.number().int().positive().optional() });

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
export type MediaInfo = z.infer<typeof mediaInfoSchema>;
export type MediaTrack = z.infer<typeof mediaTrackSchema>;
export type ShelfMembership = z.infer<typeof shelfMembershipSchema>;
export type Folder = z.infer<typeof folderSchema>;
export type ScanRun = z.infer<typeof scanRunSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type UpdateSettings = z.infer<typeof updateSettingsSchema>;
export type MatchCandidate = z.infer<typeof matchCandidateSchema>;
export type MovieFilterOptions = z.infer<typeof movieFilterOptionsSchema>;
export type ShelfCoverMovie = z.infer<typeof shelfCoverMovieSchema>;
export type ShelfSummary = z.infer<typeof shelfSummarySchema>;
export type ShelfDetail = z.infer<typeof shelfDetailSchema>;
