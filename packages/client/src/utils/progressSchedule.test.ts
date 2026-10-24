import { describe, expect, it } from 'vitest';
import { PROGRESS_INTERVAL_MS, progressAction, progressBody, type ProgressState } from './progressSchedule';

const state = (overrides: Partial<ProgressState> = {}): ProgressState => ({ now: 50_000, lastSentAt: 45_000, positionMs: 60_000, durationMs: 7_200_000, ended: false, ...overrides });

describe('progressAction', () => {
  it('sends on the first tick and then every 10 s while playing', () => {
    expect(progressAction('tick', state({ lastSentAt: null }))).toBe('put');
    expect(progressAction('tick', state({ now: 45_000 + PROGRESS_INTERVAL_MS - 1 }))).toBeNull();
    expect(progressAction('tick', state({ now: 45_000 + PROGRESS_INTERVAL_MS }))).toBe('put');
  });

  it('sends on pause, seek end and leave regardless of the interval', () => {
    for (const trigger of ['pause', 'seeked', 'leave'] as const) expect(progressAction(trigger, state({ now: 45_001 }))).toBe('put');
  });

  it('completes on ended and skips the pause that precedes it', () => {
    expect(progressAction('ended', state({ ended: true }))).toBe('complete');
    expect(progressAction('pause', state({ ended: true }))).toBeNull();
    expect(progressAction('leave', state({ ended: true }))).toBeNull();
  });

  it('waits for a known duration', () => {
    expect(progressAction('pause', state({ durationMs: Number.NaN }))).toBeNull();
    expect(progressAction('tick', state({ durationMs: 0, lastSentAt: null }))).toBeNull();
    expect(progressAction('tick', state({ durationMs: Number.POSITIVE_INFINITY, lastSentAt: null }))).toBeNull();
  });
});

describe('progressBody', () => {
  it('rounds to integers and clamps the position', () => {
    expect(progressBody(1234.5, 7_200_000.4)).toEqual({ positionMs: 1235, durationMs: 7_200_000 });
    expect(progressBody(9_000, 5_000, 3)).toEqual({ positionMs: 5_000, durationMs: 5_000, shelfId: 3 });
    expect(progressBody(-5, 5_000)).toEqual({ positionMs: 0, durationMs: 5_000 });
  });
});
