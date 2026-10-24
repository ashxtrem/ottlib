import { verifyPin } from './auth/pinHasher.js';
import { LoginThrottle } from './auth/loginThrottle.js';
import { ProfileError } from './profileError.js';

/**
 * Checks a typed profile PIN against its hash. Wrong PINs are throttled per client address and profile, so guessing
 * one profile's PIN does not lock the same device out of the others.
 */
export class ProfilePinCheck {
  public constructor(private readonly throttle = new LoginThrottle()) {}

  public verify(profileId: number, pinHash: string, pin: string | undefined, client: string): void {
    const key = `${client}:${profileId}`;
    const waitMs = this.throttle.waitMs(key);
    if (waitMs > 0) throw new ProfileError(429, `Too many wrong PINs. Try again in ${Math.ceil(waitMs / 1000)} seconds.`);
    if (!pin || !verifyPin(pin, pinHash)) { this.throttle.failed(key); throw new ProfileError(401, 'Wrong PIN.'); }
    this.throttle.succeeded(key);
  }
}
