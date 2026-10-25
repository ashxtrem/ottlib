import type { ProfileErrorCode } from '@ottlib/shared';

/** A refused profile request. Routes send `statusCode` with `{ error: code }` when a code is set, else `{ error: message }`. */
export class ProfileError extends Error {
  public constructor(public readonly statusCode: 401 | 403 | 404 | 409 | 429, message: string, public readonly code?: ProfileErrorCode) {
    super(message);
  }
}

export const profileRequired = () => new ProfileError(409, 'Pick a profile to continue. On Android TV or phone, update the OttLib app.', 'PROFILE_REQUIRED');
