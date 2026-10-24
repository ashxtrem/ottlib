import type { LocalResetResult } from '@ottlib/shared';
import type { ProfileRepository } from '../repositories/profileRepository.js';
import type { AccessPinService } from './accessPinService.js';

/**
 * The way back in when PINs are forgotten: clears the owner profile's PIN and the access PIN. Only reachable from the
 * server machine (loopback route) or its shell (`npm run reset-pins`), never from the LAN.
 */
export class LocalResetService {
  public constructor(private readonly profiles: ProfileRepository, private readonly accessPin: AccessPinService) {}

  public reset(): LocalResetResult {
    const owner = this.profiles.getOwner();
    const ownerPinCleared = Boolean(owner && owner.pinHash !== null);
    if (owner && ownerPinCleared) this.profiles.setPinHash(owner.id, null);
    return { ownerPinCleared, accessPinCleared: this.accessPin.resetPin() };
  }
}
