import { z } from 'zod';

/** Where Find hands a title: qBittorrent's search plug-ins (in-app results) or the Hashlark desktop app (a `hashlark://` link on the server PC). */
export const findProviderSchema = z.enum(['qbittorrent', 'hashlark']);
export type FindProvider = z.infer<typeof findProviderSchema>;

export type FindMode = 'off' | FindProvider;

/** `off` when torrent search is switched off, else the chosen provider. */
export function findMode(settings: { torrentSearchEnabled: boolean; findProvider: FindProvider }): FindMode {
  return settings.torrentSearchEnabled ? settings.findProvider : 'off';
}

/** Body of POST /api/find/handoff: the clients send fields, never a URL; the server builds the link. */
export const findHandoffRequestSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  year: z.number().int().optional(),
  imdbId: z.string().regex(/^tt\d{5,10}$/).optional()
});
export type FindHandoffRequest = z.infer<typeof findHandoffRequestSchema>;

export const findHandoffResultSchema = z.object({ app: z.literal('hashlark') });
export type FindHandoffResult = z.infer<typeof findHandoffResultSchema>;

/** GET /api/find/status: the current mode and whether the Hashlark link is registered on the server PC. */
export const findStatusSchema = z.object({
  mode: z.enum(['off', 'qbittorrent', 'hashlark']),
  hashlarkAvailable: z.boolean()
});
export type FindStatus = z.infer<typeof findStatusSchema>;
