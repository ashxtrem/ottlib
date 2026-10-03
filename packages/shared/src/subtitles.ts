import { z } from 'zod';
import { subtitleSourceSchema } from './playback.js';

export const subtitleLanguages = [
  { code: 'en', name: 'English' }, { code: 'hi', name: 'Hindi' },
  { code: 'ta', name: 'Tamil' }, { code: 'te', name: 'Telugu' },
  { code: 'ml', name: 'Malayalam' }, { code: 'kn', name: 'Kannada' },
  { code: 'bn', name: 'Bengali' }, { code: 'mr', name: 'Marathi' },
  { code: 'ar', name: 'Arabic' }, { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' }, { code: 'es', name: 'Spanish' },
  { code: 'it', name: 'Italian' }, { code: 'pt', name: 'Portuguese' },
  { code: 'pt-br', name: 'Brazilian Portuguese' }, { code: 'ru', name: 'Russian' },
  { code: 'ja', name: 'Japanese' }, { code: 'ko', name: 'Korean' },
  { code: 'zh-cn', name: 'Simplified Chinese' }, { code: 'zh-tw', name: 'Traditional Chinese' },
  { code: 'fa', name: 'Persian' }, { code: 'tr', name: 'Turkish' },
] as const;

export const subtitleLanguageSchema = z.string().trim().toLowerCase().regex(/^[a-z]{2,3}(?:-[a-z]{2,3})?$/);
export const subtitleSearchSchema = z.object({
  mode: z.enum(['auto', 'filename', 'manual']).default('auto'),
  query: z.string().trim().max(250).optional(),
  languages: z.array(subtitleLanguageSchema).min(1).max(10).default(['en']),
  year: z.number().int().min(1800).max(2200).nullable().optional(),
  season: z.number().int().positive().nullable().optional(),
  episode: z.number().int().positive().nullable().optional(),
}).refine(value => value.mode !== 'manual' || Boolean(value.query), { message: 'Enter a title to search', path: ['query'] });

export const subtitleResultSchema = z.object({
  id: z.string(), provider: z.string(), language: z.string(), releaseName: z.string(),
  format: z.string(), hearingImpaired: z.boolean(), forced: z.boolean(),
  hashMatch: z.boolean(), downloads: z.number().nonnegative(),
  score: z.number().min(0).max(1), downloaded: z.boolean(),
});
export const subtitleSearchResponseSchema = z.object({
  results: z.array(subtitleResultSchema), warnings: z.array(z.string()),
});
export const subtitleOptionsSchema = z.object({
  providers: z.array(z.object({ name: z.string(), configured: z.boolean() })),
  languages: z.array(z.object({ code: z.string(), name: z.string() })),
  preferredLanguages: z.array(z.string()),
});
export const subtitleDownloadSchema = z.object({ resultId: z.string().min(1).max(100) });
export const subtitleDownloadResponseSchema = z.object({ subtitle: subtitleSourceSchema, reused: z.boolean() });
export type SubtitleSearch = z.infer<typeof subtitleSearchSchema>;
export type SubtitleResult = z.infer<typeof subtitleResultSchema>;
export type SubtitleSearchResponse = z.infer<typeof subtitleSearchResponseSchema>;
export type SubtitleOptions = z.infer<typeof subtitleOptionsSchema>;
export type SubtitleDownloadResponse = z.infer<typeof subtitleDownloadResponseSchema>;
