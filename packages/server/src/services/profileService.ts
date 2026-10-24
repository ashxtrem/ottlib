import { MAX_PROFILES, type ProfileCreate, type ProfilePatch, type ProfilePinUpdate, type ProfileSummary } from '@ottlib/shared';
import type { ProfileRecord, ProfileRepository } from '../repositories/profileRepository.js';
import { sessionTokenHash, type ProfileSessionRepository } from '../repositories/profileSessionRepository.js';
import { hashPin } from './auth/pinHasher.js';
import { ProfileError } from './profileError.js';
import type { ProfilePinCheck } from './profilePinCheck.js';

export function toProfileSummary(record: ProfileRecord): ProfileSummary {
  return { id: record.id, name: record.name, color: record.color, hasPin: record.pinHash !== null, isOwner: record.isOwner };
}

const isUniqueViolation = (error: unknown) => (error as { code?: string } | null)?.code === 'SQLITE_CONSTRAINT_UNIQUE';
const nameTaken = () => new ProfileError(409, 'Another profile already has that name.', 'PROFILE_NAME_TAKEN');

/**
 * Managing profiles. `actorId` is the profile making the request (see ProfileSessionService.requireProfile).
 * The owner manages everyone; any profile may rename, recolor and re-PIN itself.
 */
export class ProfileService {
  public constructor(
    private readonly profiles: ProfileRepository,
    private readonly pins: ProfilePinCheck,
    private readonly sessions: ProfileSessionRepository
  ) {}

  public list(): ProfileSummary[] { return this.profiles.list().map(toProfileSummary); }

  public get(id: number): ProfileSummary { return toProfileSummary(this.find(id)); }

  public create(actorId: number, input: ProfileCreate): ProfileSummary {
    this.requireOwner(actorId);
    if (this.profiles.count() >= MAX_PROFILES) throw new ProfileError(409, `A library can have at most ${MAX_PROFILES} profiles.`, 'PROFILE_LIMIT');
    this.ensureNameFree(input.name);
    try {
      return toProfileSummary(this.profiles.create({ name: input.name, color: input.color, pinHash: input.pin ? hashPin(input.pin) : null }));
    } catch (error) {
      if (isUniqueViolation(error)) throw nameTaken();
      throw error;
    }
  }

  public update(actorId: number, targetId: number, patch: ProfilePatch): ProfileSummary {
    const target = this.find(targetId);
    this.requireSelfOrOwner(actorId, target);
    if (patch.name !== undefined) this.ensureNameFree(patch.name, target.id);
    try { this.profiles.update(target.id, patch); } catch (error) {
      if (isUniqueViolation(error)) throw nameTaken();
      throw error;
    }
    return this.get(target.id);
  }

  /**
   * Sets, changes or clears a PIN. A profile changing its own PIN must confirm the current one; the owner may set or
   * clear another profile's PIN without it (that is how a forgotten PIN is reset). Setting or changing a PIN signs the
   * profile out on every other device; the caller's own session (`actorToken`) stays when it belongs to that profile.
   */
  public setPin(actorId: number, targetId: number, input: ProfilePinUpdate, client: string, actorToken?: string): ProfileSummary {
    const target = this.find(targetId);
    this.requireSelfOrOwner(actorId, target);
    if (actorId === target.id && target.pinHash !== null) this.pins.verify(target.id, target.pinHash, input.currentPin, client);
    this.profiles.setPinHash(target.id, input.pin === null ? null : hashPin(input.pin));
    if (input.pin !== null) this.endOtherSessions(target.id, actorId === target.id ? actorToken : undefined);
    return this.get(target.id);
  }

  /** Deletes a profile with its sessions, hides and history (foreign-key cascades). The owner profile stays. */
  public remove(actorId: number, targetId: number): void {
    this.requireOwner(actorId);
    const target = this.find(targetId);
    if (target.isOwner) throw new ProfileError(403, 'The owner profile cannot be deleted.');
    this.profiles.delete(target.id);
  }

  private endOtherSessions(profileId: number, keepToken: string | undefined): void {
    if (keepToken) this.sessions.deleteForProfileExcept(profileId, sessionTokenHash(keepToken));
    else this.sessions.deleteForProfile(profileId);
  }

  private find(id: number): ProfileRecord {
    const record = this.profiles.get(id);
    if (!record) throw new ProfileError(404, 'Profile not found.');
    return record;
  }

  private requireOwner(actorId: number): void {
    if (!this.profiles.get(actorId)?.isOwner) throw new ProfileError(403, 'Only the owner profile can do that.');
  }

  private requireSelfOrOwner(actorId: number, target: ProfileRecord): void {
    if (actorId !== target.id) this.requireOwner(actorId);
  }

  private ensureNameFree(name: string, exceptId?: number): void {
    const wanted = name.toLowerCase();
    if (this.profiles.list().some((profile) => profile.id !== exceptId && profile.name.toLowerCase() === wanted)) throw nameTaken();
  }
}
