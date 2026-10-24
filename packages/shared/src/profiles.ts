import { z } from 'zod';
import { accessPinSchema } from './auth.js';

/** Avatar colors a profile can pick; the first one belongs to the default owner profile. */
export const profileColors = ['#e50914', '#f5a524', '#17c964', '#006fee', '#7828c8', '#f31260'] as const;

export const MAX_PROFILES = 6;

/** How a title was handed off to a player, recorded in playback history. */
export const playMethods = ['android_app', 'm3u', 'intent', 'local_launch'] as const;

/** Error codes the profile API sends as `{ error }` with status 409. */
export const profileErrorCodes = ['PROFILE_REQUIRED', 'PROFILE_LIMIT', 'PROFILE_NAME_TAKEN'] as const;

/** Header a client sends its profile session token in. */
export const PROFILE_SESSION_HEADER = 'x-profile-session';

/** A profile PIN follows the access-PIN rule: 4–8 digits. */
export const profilePinSchema = accessPinSchema;
export const profileNameSchema = z.string().trim().min(1, 'Name is required.').max(24, 'Name must be 24 characters or fewer.');
export const profileColorSchema = z.enum(profileColors);

export const profileSummarySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  color: z.string(),
  hasPin: z.boolean(),
  isOwner: z.boolean()
});

export const profileCreateSchema = z.object({ name: profileNameSchema, color: profileColorSchema, pin: profilePinSchema.optional() });
/** Any typed PIN is accepted here; a wrong one is answered with 401, not a validation error. */
export const profileSelectSchema = z.object({ pin: z.string().max(32).optional() });
export const profileSelectResultSchema = z.object({ token: z.string(), profile: profileSummarySchema });
export const profileMeSchema = z.object({ profile: profileSummarySchema });
export const profilePatchSchema = z.object({ name: profileNameSchema.optional(), color: profileColorSchema.optional() });
/** `pin: null` clears the PIN. `currentPin` is needed when a profile changes its own existing PIN. */
export const profilePinUpdateSchema = z.object({ currentPin: z.string().max(32).optional(), pin: profilePinSchema.nullable() });
/** Announces a play handed off to a player; `positionMs` defaults to the profile's resume point. */
export const playStartSchema = z.object({ method: z.enum(playMethods), positionMs: z.number().int().nonnegative().optional() });
export const playStartResultSchema = z.object({ playId: z.number().int() });
export const localResetResultSchema = z.object({ ownerPinCleared: z.boolean(), accessPinCleared: z.boolean() });

export type ProfileColor = (typeof profileColors)[number];
export type PlayMethod = (typeof playMethods)[number];
export type ProfileErrorCode = (typeof profileErrorCodes)[number];
export type ProfileSummary = z.infer<typeof profileSummarySchema>;
export type ProfileCreate = z.infer<typeof profileCreateSchema>;
export type ProfileSelectResult = z.infer<typeof profileSelectResultSchema>;
export type ProfilePatch = z.infer<typeof profilePatchSchema>;
export type ProfilePinUpdate = z.infer<typeof profilePinUpdateSchema>;
export type PlayStart = z.infer<typeof playStartSchema>;
export type PlayStartResult = z.infer<typeof playStartResultSchema>;
export type LocalResetResult = z.infer<typeof localResetResultSchema>;
