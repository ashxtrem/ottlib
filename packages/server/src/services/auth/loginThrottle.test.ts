import { describe, expect, it } from 'vitest';
import { LoginThrottle } from './loginThrottle.js';

describe('LoginThrottle', () => {
  it('allows a few failures, then doubles the wait per failure up to an hour', () => {
    let now = 0; const throttle = new LoginThrottle(() => now);
    for (let failure = 0; failure < 4; failure++) throttle.failed('a');
    expect(throttle.waitMs('a')).toBe(0);
    throttle.failed('a'); expect(throttle.waitMs('a')).toBe(30_000);
    throttle.failed('a'); expect(throttle.waitMs('a')).toBe(60_000);
    for (let failure = 0; failure < 20; failure++) throttle.failed('a');
    expect(throttle.waitMs('a')).toBe(3_600_000);
    now += 3_600_000; expect(throttle.waitMs('a')).toBe(0);
    expect(throttle.waitMs('b')).toBe(0);
  });

  it('forgets a client after a correct PIN', () => {
    const throttle = new LoginThrottle(() => 0);
    for (let failure = 0; failure < 6; failure++) throttle.failed('a');
    throttle.succeeded('a');
    expect(throttle.waitMs('a')).toBe(0);
  });
});
