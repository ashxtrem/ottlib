import { z } from 'zod';

/** Identifies what "hide this title" means: a whole TV show, or a single movie. */
export interface Hideable { id: number; showKey: string | null }

export function hideKeyOf(item: Hideable): string {
  return item.showKey ?? `m:${item.id}`;
}

/** TV rows are titled "Show · S1E2 · Episode"; hiding applies to the show, so display just its name. */
export function hiddenDisplayTitle(title: string, showKey: string | null): string {
  if (!showKey) return title;
  const match = /\s·\sS\d+E\d+/.exec(title);
  return match ? title.slice(0, match.index) : title;
}

/** A profile keeps at most this many hidden titles; hiding more drops the oldest. */
export const MAX_HIDES_PER_PROFILE = 2000;

/** A `hideKeyOf` value. */
export const hideKeySchema = z.string().min(1, 'Key is required.').max(200, 'Key must be 200 characters or fewer.');
export const hideRequestSchema = z.object({ key: hideKeySchema });
/** Keys a client kept before hides moved to the server; duplicates are ignored. */
export const hideImportSchema = z.object({ keys: z.array(hideKeySchema).max(10_000) });
/** The profile's hidden keys, newest first. */
export const hideListSchema = z.object({ keys: z.array(z.string()) });

export type HideRequest = z.infer<typeof hideRequestSchema>;
export type HideImport = z.infer<typeof hideImportSchema>;
export type HideList = z.infer<typeof hideListSchema>;
