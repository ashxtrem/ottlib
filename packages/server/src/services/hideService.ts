import { MAX_HIDES_PER_PROFILE } from '@ottlib/shared';
import type { HideRepository } from '../repositories/hideRepository.js';

/** Hidden titles per profile, newest first; past the cap the oldest hides are dropped. */
export class HideService {
  public constructor(private readonly hides: HideRepository, private readonly max: number = MAX_HIDES_PER_PROFILE) {}

  public list(profileId: number): string[] { return this.hides.list(profileId); }

  public add(profileId: number, key: string): string[] {
    this.hides.add(profileId, key);
    return this.trimmed(profileId);
  }

  public remove(profileId: number, key: string): string[] {
    this.hides.remove(profileId, key);
    return this.list(profileId);
  }

  /** Adds keys a client kept locally; keys already hidden stay where they are. */
  public import(profileId: number, keys: string[]): string[] {
    this.hides.addMany(profileId, [...new Set(keys)]);
    return this.trimmed(profileId);
  }

  private trimmed(profileId: number): string[] {
    if (this.hides.count(profileId) > this.max) this.hides.trimTo(profileId, this.max);
    return this.list(profileId);
  }
}
