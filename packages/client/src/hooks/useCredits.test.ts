import { describe, expect, it } from 'vitest';
import { creditsButtons, creditsStartAt, type CreditsButtonsInput } from './useCredits';

const credits = { startMs: 1_400_000, source: 'chapter' as const };
const base: CreditsButtonsInput = { credits, autoSkip: true, watching: false, hasNext: true, positionMs: 0, ended: false, upNextCancelled: false };

describe('creditsStartAt', () => {
  it('starts up next at the credits only with auto-skip on and the credits not being watched', () => {
    expect(creditsStartAt(base)).toBe(1_400_000);
    expect(creditsStartAt({ ...base, autoSkip: false })).toBeNull();
    expect(creditsStartAt({ ...base, watching: true })).toBeNull();
  });

  it('keeps the 20 s lead (null) without credits', () => {
    expect(creditsStartAt({ ...base, credits: null })).toBeNull();
  });
});

describe('creditsButtons', () => {
  it('shows nothing before the credits', () => {
    expect(creditsButtons({ ...base, positionMs: 1_399_999 })).toEqual({ skip: false, watch: false });
    expect(creditsButtons({ ...base, autoSkip: false, positionMs: 1_399_999 })).toEqual({ skip: false, watch: false });
  });

  it('at the credits start with auto-skip on and a next title: "Watch credits" (the countdown runs)', () => {
    expect(creditsButtons({ ...base, positionMs: 1_400_000 })).toEqual({ skip: false, watch: true });
  });

  it('at the credits start with auto-skip on and nothing next: "Skip credits"', () => {
    expect(creditsButtons({ ...base, hasNext: false, positionMs: 1_400_000 })).toEqual({ skip: true, watch: false });
  });

  it('with auto-skip off: "Skip credits" during the credits until the end', () => {
    expect(creditsButtons({ ...base, autoSkip: false, positionMs: 1_400_000 })).toEqual({ skip: true, watch: false });
    expect(creditsButtons({ ...base, autoSkip: false, positionMs: 1_499_000 })).toEqual({ skip: true, watch: false });
    expect(creditsButtons({ ...base, autoSkip: false, positionMs: 1_500_000, ended: true })).toEqual({ skip: false, watch: false });
  });

  it('shows nothing after "Watch credits", after up next\'s Cancel, or without credits', () => {
    expect(creditsButtons({ ...base, watching: true, positionMs: 1_450_000 })).toEqual({ skip: false, watch: false });
    expect(creditsButtons({ ...base, upNextCancelled: true, positionMs: 1_450_000 })).toEqual({ skip: false, watch: false });
    expect(creditsButtons({ ...base, credits: null, positionMs: 1_450_000 })).toEqual({ skip: false, watch: false });
  });
});
