import { randomBytes } from 'node:crypto';
import type { ProfileSelectResult } from '@ottlib/shared';
import type { ProfileRepository } from '../repositories/profileRepository.js';
import { sessionTokenHash as tokenHash, type ProfileSessionRepository } from '../repositories/profileSessionRepository.js';
import { ProfileError, profileRequired } from './profileError.js';
import type { ProfilePinCheck } from './profilePinCheck.js';
import { toProfileSummary } from './profileService.js';

/** `last_seen_at` is written at most this often per session. */
const touchIntervalMs = 60_000;

/** Signing in to a profile (a session token per device) and working out which profile a request acts as. */
export class ProfileSessionService {
  public constructor(
    private readonly profiles: ProfileRepository,
    private readonly sessions: ProfileSessionRepository,
    private readonly pins: ProfilePinCheck,
    private readonly now: () => number = Date.now
  ) {}

  /** Checks the profile's PIN (when it has one) and returns a new session token. Only the token's SHA-256 is stored. */
  public select(profileId: number, pin: string | undefined, client: string, deviceId: string | null): ProfileSelectResult {
    const profile = this.profiles.get(profileId);
    if (!profile) throw new ProfileError(404, 'Profile not found.');
    if (profile.pinHash !== null) this.pins.verify(profile.id, profile.pinHash, pin, client);
    const token = randomBytes(32).toString('base64url');
    this.sessions.create(tokenHash(token), profile.id, deviceId);
    return { token, profile: toProfileSummary(profile) };
  }

  public deselect(token: string): void { this.sessions.delete(tokenHash(token)); }

  /** The profile a session token belongs to, or undefined for an unknown token. Refreshes `last_seen_at` now and then. */
  public sessionProfile(token: string): number | undefined {
    const hash = tokenHash(token);
    const session = this.sessions.find(hash);
    if (!session) return undefined;
    const now = this.now();
    if (!(now - Date.parse(session.lastSeenAt) < touchIntervalMs)) this.sessions.touch(hash, new Date(now).toISOString());
    return session.profileId;
  }

  /**
   * The profile a request acts as: its session's profile, or — so clients that predate profiles keep working — the only
   * profile when exactly one exists and it has no PIN. Otherwise 409 PROFILE_REQUIRED.
   */
  public requireProfile(sessionProfileId: number | undefined): number {
    if (sessionProfileId !== undefined) return sessionProfileId;
    const all = this.profiles.list();
    if (all.length === 1 && all[0]!.pinHash === null) return all[0]!.id;
    throw profileRequired();
  }
}
