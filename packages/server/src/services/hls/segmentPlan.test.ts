import { describe, expect, it } from 'vitest';
import { planSegments } from './segmentPlan.js';

describe('planSegments', () => {
  it('cuts remux segments at every keyframe and ends at the duration', () => {
    expect(planSegments({ mode: 'remux', durationMs: 10_500, keyframesMs: [0, 2002, 4004, 8008] })).toEqual({
      segments: [{ start: 0, duration: 2002 }, { start: 2002, duration: 2002 }, { start: 4004, duration: 4004 }, { start: 8008, duration: 2492 }],
      targetDuration: 5,
    });
  });

  it('folds the lead-in before a late first keyframe into segment 0 (ffmpeg starts its first segment there)', () => {
    const plan = planSegments({ mode: 'remux', durationMs: 6000, keyframesMs: [120, 3000] });
    expect(plan.segments).toEqual([{ start: 0, duration: 3000 }, { start: 3000, duration: 3000 }]);
  });

  it('falls back to 4 s for a zero or NaN transcode segment length', () => {
    expect(planSegments({ mode: 'transcode', durationMs: 8000, segmentMs: 0 }).segments).toHaveLength(2);
    expect(planSegments({ mode: 'transcode', durationMs: 8000, segmentMs: Number.NaN }).segments).toHaveLength(2);
  });

  it('drops keyframes at or past the duration and duplicates', () => {
    const plan = planSegments({ mode: 'remux', durationMs: 5000, keyframesMs: [0, 2500, 2500, 5000, 6000] });
    expect(plan.segments).toEqual([{ start: 0, duration: 2500 }, { start: 2500, duration: 2500 }]);
    expect(plan.targetDuration).toBe(3);
  });

  it('plans 4 s transcode segments with a short last one', () => {
    expect(planSegments({ mode: 'transcode', durationMs: 9_500 })).toEqual({
      segments: [{ start: 0, duration: 4000 }, { start: 4000, duration: 4000 }, { start: 8000, duration: 1500 }],
      targetDuration: 4,
    });
  });

  it('honours a custom transcode segment length', () => {
    expect(planSegments({ mode: 'transcode', durationMs: 6000, segmentMs: 3000 }).segments).toHaveLength(2);
  });

  it('returns no segments for a zero duration', () => {
    expect(planSegments({ mode: 'transcode', durationMs: 0 })).toEqual({ segments: [], targetDuration: 1 });
  });
});
