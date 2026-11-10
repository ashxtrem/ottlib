import { z } from 'zod';
import { movieListItemSchema } from './index.js';

/** A part of a collection (saga) the library does not have, with its poster cached on the server. */
export const missingCollectionPartSchema = z.object({
  tmdbId: z.string(),
  title: z.string(),
  year: z.number().int().nullable(),
  posterUrl: z.string().nullable()
});

/** The collection a title belongs to: the titles the library owns, in year order, and the parts it does not. */
export const movieCollectionSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  // Lazy: the list item schema lives in index.ts, which re-exports this file.
  owned: z.array(z.lazy(() => movieListItemSchema)),
  missing: z.array(missingCollectionPartSchema)
});

export const collectionFilterOptionSchema = z.object({ id: z.number().int(), name: z.string(), count: z.number().int().nonnegative() });

export type MissingCollectionPart = z.infer<typeof missingCollectionPartSchema>;
export type MovieCollection = z.infer<typeof movieCollectionSchema>;
export type CollectionFilterOption = z.infer<typeof collectionFilterOptionSchema>;
