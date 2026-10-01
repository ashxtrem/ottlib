import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { AuthStatus, SetAccessPin } from '@ottlib/shared';
import { AccessPinRepository } from '../repositories/accessPinRepository.js';
import { AuthSessionRepository } from '../repositories/authSessionRepository.js';
import { hashPin, verifyPin } from './auth/pinHasher.js';
import { LoginThrottle } from './auth/loginThrottle.js';

export class AccessPinError extends Error {
  public constructor(message: string, public readonly statusCode: 401 | 429) { super(message); }
}

const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
const newSecret = () => randomBytes(32).toString('hex');

/**
 * The optional access PIN. With no PIN set the server stays in trusted-LAN mode and everything is open.
 * With a PIN, devices sign in once and keep a session token; stream links carry a per-movie key instead,
 * so external players (VLC, Android "Play with") work without the token.
 */
export class AccessPinService {
  public constructor(private readonly pins: AccessPinRepository, private readonly sessions: AuthSessionRepository, private readonly throttle = new LoginThrottle()) {}

  public enabled(): boolean { return this.pins.get() !== undefined; }

  public isAuthenticated(token: string | undefined): boolean {
    if (!this.enabled()) return true;
    return Boolean(token) && this.sessions.exists(tokenHash(token!));
  }

  public status(token: string | undefined): AuthStatus { return { pinEnabled: this.enabled(), authenticated: this.isAuthenticated(token) }; }

  /** Checks the PIN and returns a new session token. */
  public login(pin: string, client: string): string {
    const record = this.pins.get();
    if (!record) throw new AccessPinError('No access PIN is set.', 401);
    this.checkPin(pin, record.pinHash, client);
    return this.newSession();
  }

  public logout(token: string | undefined): void { if (token) this.sessions.remove(tokenHash(token)); }

  /** Sets or changes the PIN. Every other device is signed out; the caller gets a fresh session token. */
  public setPin(input: SetAccessPin, client: string): string {
    const record = this.pins.get();
    if (record) this.checkPin(input.currentPin ?? '', record.pinHash, client);
    this.sessions.clear();
    this.pins.set({ pinHash: hashPin(input.newPin), streamSecret: newSecret() });
    return this.newSession();
  }

  /** Back to trusted-LAN mode. */
  public removePin(currentPin: string, client: string): void {
    const record = this.pins.get();
    if (!record) return;
    this.checkPin(currentPin, record.pinHash, client);
    this.pins.clear(); this.sessions.clear();
  }

  /** Query string that lets a stream or subtitle URL for this movie play without a session, or '' when no PIN is set. */
  public streamQuery(movieId: number): string {
    const record = this.pins.get();
    return record ? `?key=${this.streamKey(record.streamSecret, movieId)}` : '';
  }

  public verifyStreamKey(movieId: number, key: string | undefined): boolean {
    const record = this.pins.get();
    if (!record) return true;
    if (!key) return false;
    const expected = Buffer.from(this.streamKey(record.streamSecret, movieId)); const actual = Buffer.from(key);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  private streamKey(secret: string, movieId: number): string { return createHmac('sha256', secret).update(`stream:${movieId}`).digest('base64url').slice(0, 32); }

  private checkPin(pin: string, pinHash: string, client: string): void {
    const waitMs = this.throttle.waitMs(client);
    if (waitMs > 0) throw new AccessPinError(`Too many wrong PINs. Try again in ${Math.ceil(waitMs / 1000)} seconds.`, 429);
    if (!verifyPin(pin, pinHash)) { this.throttle.failed(client); throw new AccessPinError('Wrong PIN.', 401); }
    this.throttle.succeeded(client);
  }

  private newSession(): string {
    const token = randomBytes(32).toString('base64url');
    this.sessions.add(tokenHash(token));
    return token;
  }
}
