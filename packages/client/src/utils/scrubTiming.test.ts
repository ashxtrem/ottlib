import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FRAME_STEP_MS, SCRUB_INTERVAL_MS, createThrottle, frameTimeMs, frameUrl, previewLeftPx, thumbCenterPx } from './scrubTiming';

describe('createThrottle', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('runs the first call at once and folds the rest into one trailing call with the last value', () => {
    const run = vi.fn();
    const throttled = createThrottle<number>(run, SCRUB_INTERVAL_MS);
    throttled(1);
    throttled(2);
    throttled(3);
    expect(run.mock.calls).toEqual([[1]]);
    vi.advanceTimersByTime(SCRUB_INTERVAL_MS - 1);
    expect(run).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(run.mock.calls).toEqual([[1], [3]]);
  });

  it('never runs twice within one interval, however fast the calls come', () => {
    const run = vi.fn();
    const throttled = createThrottle<number>(run, SCRUB_INTERVAL_MS);
    for (let at = 0; at < 1000; at += 10) { throttled(at); vi.advanceTimersByTime(10); }
    vi.advanceTimersByTime(SCRUB_INTERVAL_MS);
    expect(run.mock.calls.length).toBeLessThanOrEqual(Math.ceil(1000 / SCRUB_INTERVAL_MS) + 1);
    expect(run.mock.calls.at(-1)?.[0]).toBe(990);
  });

  it('runs the next call at once after a quiet interval', () => {
    const run = vi.fn();
    const throttled = createThrottle<string>(run, SCRUB_INTERVAL_MS);
    throttled('a');
    vi.advanceTimersByTime(SCRUB_INTERVAL_MS);
    throttled('b');
    expect(run.mock.calls).toEqual([['a'], ['b']]);
  });

  it('cancel drops the trailing call, and later calls start fresh', () => {
    const run = vi.fn();
    const throttled = createThrottle<number>(run, SCRUB_INTERVAL_MS);
    throttled(1);
    throttled(2);
    throttled.cancel();
    vi.advanceTimersByTime(SCRUB_INTERVAL_MS * 3);
    expect(run.mock.calls).toEqual([[1]]);
    throttled(4);
    expect(run.mock.calls).toEqual([[1], [4]]);
  });
});

describe('frameTimeMs', () => {
  it('rounds to the 2 s step the server uses', () => {
    expect(frameTimeMs(0, null)).toBe(0);
    expect(frameTimeMs(999, null)).toBe(0);
    expect(frameTimeMs(1000, null)).toBe(FRAME_STEP_MS);
    expect(frameTimeMs(41_300, null)).toBe(42_000);
  });

  it('stays at 0 or above and one step short of a known end', () => {
    expect(frameTimeMs(-5000, null)).toBe(0);
    expect(frameTimeMs(Number.NaN, null)).toBe(0);
    expect(frameTimeMs(100_000, 100_000)).toBe(98_000);
    expect(frameTimeMs(1000, 1500)).toBe(0);
  });
});

describe('frameUrl', () => {
  it('appends the time to both forms of the preview url', () => {
    expect(frameUrl('/api/movies/1/frame?key=abc', 4000)).toBe('/api/movies/1/frame?key=abc&t=4000');
    expect(frameUrl('/api/movies/1/frame?', 4000)).toBe('/api/movies/1/frame?&t=4000');
  });
});

describe('thumbCenterPx', () => {
  it('travels the bar minus the thumb', () => {
    expect(thumbCenterPx(0, 1000, 200)).toBe(8);
    expect(thumbCenterPx(500, 1000, 200)).toBe(100);
    expect(thumbCenterPx(1000, 1000, 200)).toBe(192);
    expect(thumbCenterPx(5000, 1000, 200)).toBe(192);
    expect(thumbCenterPx(10, 0, 200)).toBe(8);
  });
});

describe('previewLeftPx', () => {
  // A 320 px phone: the bar starts 12 px in and is 296 px wide.
  const phone = { widthPx: 160, barLeftPx: 12, viewportWidthPx: 320 };

  it('centres on the thumb in the middle', () => {
    expect(previewLeftPx({ ...phone, centerPx: 148 })).toBe(68);
  });

  it('stays inside the viewport at the start of the bar', () => {
    const left = previewLeftPx({ ...phone, centerPx: 8 });
    expect(phone.barLeftPx + left).toBe(8);
  });

  it('stays inside the viewport at the end of the bar', () => {
    const left = previewLeftPx({ ...phone, centerPx: 288 });
    expect(phone.barLeftPx + left + phone.widthPx).toBe(320 - 8);
  });

  it('keeps every thumb position fully on screen', () => {
    for (let center = 8; center <= 288; center += 4) {
      const left = phone.barLeftPx + previewLeftPx({ ...phone, centerPx: center });
      expect(left).toBeGreaterThanOrEqual(8);
      expect(left + phone.widthPx).toBeLessThanOrEqual(312);
    }
  });

  it('prefers the left edge when the viewport is narrower than the preview', () => {
    const left = previewLeftPx({ centerPx: 50, widthPx: 160, barLeftPx: 0, viewportWidthPx: 150 });
    expect(left).toBe(8);
  });
});
