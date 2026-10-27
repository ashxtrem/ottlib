import { describe, expect, it } from 'vitest';
import { heldCountdownStart, reachedStartAt, upNextPhase, type UpNextInput } from './upNextTiming';

const base: UpNextInput = { hasNext: true, cancelled: false, positionMs: 0, durationMs: 1_500_000, endedAtMs: null, nowMs: 0 };

describe('upNextPhase', () => {
  it('stays hidden until 20 s remain', () => {
    expect(upNextPhase({ ...base, positionMs: 1_479_999 })).toEqual({ kind: 'hidden' });
    expect(upNextPhase({ ...base, positionMs: 1_480_000 })).toEqual({ kind: 'preview' });
    expect(upNextPhase({ ...base, positionMs: 1_499_000 })).toEqual({ kind: 'preview' });
  });

  it('counts down 10 s after the end, then advances', () => {
    expect(upNextPhase({ ...base, endedAtMs: 5_000, nowMs: 5_000 })).toEqual({ kind: 'countdown', secondsLeft: 10 });
    expect(upNextPhase({ ...base, endedAtMs: 5_000, nowMs: 5_001 })).toEqual({ kind: 'countdown', secondsLeft: 10 });
    expect(upNextPhase({ ...base, endedAtMs: 5_000, nowMs: 14_500 })).toEqual({ kind: 'countdown', secondsLeft: 1 });
    expect(upNextPhase({ ...base, endedAtMs: 5_000, nowMs: 15_000 })).toEqual({ kind: 'advance' });
  });

  it('with a start-at (the credits), skips the 20 s preview and counts down from the credits start', () => {
    const credits = { ...base, startAtMs: 1_400_000 };
    expect(upNextPhase({ ...credits, positionMs: 1_399_999 })).toEqual({ kind: 'hidden' });
    // Not reached yet (the hook sets endedAtMs when the position reaches the start): no preview, even in the last 20 s.
    expect(upNextPhase({ ...credits, positionMs: 1_480_000 })).toEqual({ kind: 'hidden' });
    expect(upNextPhase({ ...credits, positionMs: 1_400_000, endedAtMs: 7_000, nowMs: 7_000 })).toEqual({ kind: 'countdown', secondsLeft: 10 });
    expect(upNextPhase({ ...credits, positionMs: 1_409_000, endedAtMs: 7_000, nowMs: 17_000 })).toEqual({ kind: 'advance' });
    expect(upNextPhase({ ...credits, cancelled: true, endedAtMs: 7_000, nowMs: 8_000 })).toEqual({ kind: 'hidden' });
  });

  it('keeps the 20 s preview when the start-at is null', () => {
    expect(upNextPhase({ ...base, startAtMs: null, positionMs: 1_480_000 })).toEqual({ kind: 'preview' });
  });

  it('reachedStartAt only with a start-at at or before the position', () => {
    expect(reachedStartAt(1_400_000, 1_400_000)).toBe(true);
    expect(reachedStartAt(1_399_999, 1_400_000)).toBe(false);
    expect(reachedStartAt(1_400_000, null)).toBe(false);
  });

  it('holds the early countdown while paused and resumes counting on play', () => {
    const credits = { ...base, startAtMs: 1_400_000, positionMs: 1_400_000 };
    // Counted 3 s, then paused for 20 s: the start moves forward tick by tick, so 7 s are still left.
    let endedAtMs = 7_000;
    for (let now = 10_250; now <= 30_000; now += 250) endedAtMs = heldCountdownStart(endedAtMs, now - 250, now, true);
    expect(upNextPhase({ ...credits, endedAtMs, nowMs: 30_000 })).toEqual({ kind: 'countdown', secondsLeft: 7 });
    // Playing again: the start stays put and the countdown runs out 7 s later.
    expect(heldCountdownStart(endedAtMs, 30_000, 30_250, false)).toBe(endedAtMs);
    expect(upNextPhase({ ...credits, endedAtMs, nowMs: 37_000 })).toEqual({ kind: 'advance' });
  });

  it('shows nothing after Cancel, without a next one, or while the duration is unknown', () => {
    expect(upNextPhase({ ...base, cancelled: true, endedAtMs: 0, nowMs: 20_000 })).toEqual({ kind: 'hidden' });
    expect(upNextPhase({ ...base, hasNext: false, positionMs: 1_499_000 })).toEqual({ kind: 'hidden' });
    expect(upNextPhase({ ...base, durationMs: Number.NaN, positionMs: 10 })).toEqual({ kind: 'hidden' });
  });
});
