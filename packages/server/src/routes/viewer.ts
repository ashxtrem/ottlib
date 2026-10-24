import type { FastifyRequest } from 'fastify';
import { deviceIdSchema } from '@ottlib/shared';
import type { Viewer } from '../services/viewer.js';
import { requireProfile } from './profileContext.js';

/** `x-device-id` is optional; a malformed one throws (→ 400 from the app's error handler). */
export function deviceIdOf(request: FastifyRequest): string | null {
  const value = request.headers['x-device-id'];
  if (value === undefined) return null;
  const parsed = deviceIdSchema.safeParse(value);
  if (!parsed.success) throw new Error('X-Device-Id must be a UUID');
  return parsed.data;
}

/** The profile this request acts for (→ 409 PROFILE_REQUIRED when none), plus its device as the last device. */
export function viewerOf(request: FastifyRequest): Viewer {
  const deviceId = deviceIdOf(request);
  return { profileId: requireProfile(request), deviceId };
}
