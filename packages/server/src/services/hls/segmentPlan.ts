import { transcodeSegmentMs } from '../../config/keyframes.js';

export interface PlannedSegment {
  /** Start time in ms. */
  start: number;
  /** Length in ms. */
  duration: number;
}

export interface SegmentPlan {
  segments: PlannedSegment[];
  /** Longest segment in whole seconds, rounded up (#EXT-X-TARGETDURATION). */
  targetDuration: number;
}

export type SegmentPlanInput =
  | { mode: 'remux'; durationMs: number; keyframesMs: readonly number[] }
  | { mode: 'transcode'; durationMs: number; segmentMs?: number };

function boundaries(input: SegmentPlanInput): number[] {
  const { durationMs } = input;
  if (input.mode === 'remux') {
    const keyframes = [...new Set(input.keyframesMs)].filter((time) => time >= 0 && time < durationMs).sort((a, b) => a - b);
    // ffmpeg's first segment starts at the first keyframe whenever that is, so a late first keyframe opens segment 0.
    return [0, ...keyframes.slice(1)];
  }
  const requested = input.segmentMs ?? transcodeSegmentMs;
  const step = Number.isFinite(requested) && requested > 0 ? requested : transcodeSegmentMs;
  const starts: number[] = [];
  for (let start = 0; start < durationMs; start += step) starts.push(start);
  return starts;
}

/** Remux: one segment per keyframe interval (the first starts at 0, the last ends at the duration). Transcode: fixed-length segments. */
export function planSegments(input: SegmentPlanInput): SegmentPlan {
  if (!(input.durationMs > 0)) return { segments: [], targetDuration: 1 };
  const starts = boundaries(input);
  const segments = starts.map((start, index) => ({ start, duration: (starts[index + 1] ?? input.durationMs) - start }));
  const longest = Math.max(...segments.map((segment) => segment.duration));
  return { segments, targetDuration: Math.max(1, Math.ceil(longest / 1000)) };
}
