import { z } from 'zod';
import { movieListItemSchema } from './index.js';

/** Why a title is worth replacing: it is below the preferred resolution, or stored in an old codec. */
export const upgradeReasonSchema = z.enum(['resolution', 'codec']);

export const upgradeCandidateSchema = z.object({
  movie: z.lazy(() => movieListItemSchema),
  reason: upgradeReasonSchema
});

export const upgradeCandidatesSchema = z.array(upgradeCandidateSchema);

export type UpgradeReason = z.infer<typeof upgradeReasonSchema>;
export type UpgradeCandidate = z.infer<typeof upgradeCandidateSchema>;
