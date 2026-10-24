import { describe, expect, it } from 'vitest';
import { END_TOLERANCE_MS, REPEAT_END_WINDOW_MS, isRealEnd } from './playbackEnd';

const HOUR = 3_600_000;

describe('isRealEnd', () => {
  it('treats an ended mid-file as false', () => {
    expect(isRealEnd(HOUR / 2, HOUR, null)).toBe(false);
  });

  it('treats an ended within 15 s of the end as real', () => {
    expect(isRealEnd(HOUR - END_TOLERANCE_MS, HOUR, null)).toBe(true);
    expect(isRealEnd(HOUR, HOUR, null)).toBe(true);
    expect(isRealEnd(HOUR - END_TOLERANCE_MS - 1, HOUR, null)).toBe(false);
  });

  it('trusts the event when the guard duration is null, NaN, infinite or not positive', () => {
    expect(isRealEnd(1_000, null, null)).toBe(true);
    expect(isRealEnd(1_000, Number.NaN, null)).toBe(true);
    expect(isRealEnd(1_000, Number.POSITIVE_INFINITY, null)).toBe(true);
    expect(isRealEnd(1_000, 0, null)).toBe(true);
    expect(isRealEnd(1_000, -5, null)).toBe(true);
  });

  it('treats a repeat within 5 s of the last false end as real', () => {
    expect(isRealEnd(600_000 + 2_000, HOUR, 600_000)).toBe(true);
    expect(isRealEnd(600_000 - REPEAT_END_WINDOW_MS, HOUR, 600_000)).toBe(true);
  });

  it('treats an ended outside that window as a new false end', () => {
    expect(isRealEnd(600_000 + REPEAT_END_WINDOW_MS + 1, HOUR, 600_000)).toBe(false);
    expect(isRealEnd(1_200_000, HOUR, 600_000)).toBe(false);
  });
});
