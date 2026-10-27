import { z } from 'zod';

/** Where a title's end credits start: a user's mark, a chapter named for the credits, or learned from a sibling episode. */
export const creditsSchema = z.object({
  startMs: z.number().int().nonnegative(),
  source: z.enum(['mark', 'chapter', 'series'])
});

/** Body of PUT /api/movies/:id/credits: set the "credits start here" mark, or clear it with null. */
export const creditsMarkRequestSchema = z.object({
  startMs: z.number().int().nonnegative().nullable()
});

/** Answer of PUT /api/movies/:id/credits: the credits the title resolves to after the change. */
export const creditsMarkResultSchema = z.object({
  credits: creditsSchema.nullable()
});

/** Body of PUT /api/movies/:id/auto-skip: this profile's override for the movie (an episode: its whole series); null clears it. */
export const autoSkipOverrideRequestSchema = z.object({
  enabled: z.boolean().nullable()
});

/** Answer of PUT /api/movies/:id/auto-skip: whether credits are now skipped for the title, override or default. */
export const autoSkipOverrideResultSchema = z.object({
  autoSkipCredits: z.boolean()
});

/** GET/PUT /api/profiles/current/auto-skip: the profile's auto-skip default per media type. */
export const autoSkipDefaultsSchema = z.object({
  movie: z.boolean(),
  tv: z.boolean()
});

export type Credits = z.infer<typeof creditsSchema>;
export type CreditsSource = Credits['source'];
export type CreditsMarkRequest = z.infer<typeof creditsMarkRequestSchema>;
export type CreditsMarkResult = z.infer<typeof creditsMarkResultSchema>;
export type AutoSkipOverrideRequest = z.infer<typeof autoSkipOverrideRequestSchema>;
export type AutoSkipOverrideResult = z.infer<typeof autoSkipOverrideResultSchema>;
export type AutoSkipDefaults = z.infer<typeof autoSkipDefaultsSchema>;
