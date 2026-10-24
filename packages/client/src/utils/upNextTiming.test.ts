import { describe, expect, it } from 'vitest';
import { upNextPhase, type UpNextInput } from './upNextTiming';

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

  it('shows nothing after Cancel, without a next one, or while the duration is unknown', () => {
    expect(upNextPhase({ ...base, cancelled: true, endedAtMs: 0, nowMs: 20_000 })).toEqual({ kind: 'hidden' });
    expect(upNextPhase({ ...base, hasNext: false, positionMs: 1_499_000 })).toEqual({ kind: 'hidden' });
    expect(upNextPhase({ ...base, durationMs: Number.NaN, positionMs: 10 })).toEqual({ kind: 'hidden' });
  });
});
