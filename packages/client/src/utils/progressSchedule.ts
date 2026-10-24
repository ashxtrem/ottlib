import type { PlaybackProgressUpdate } from '@ottlib/shared';

/** While playing, progress goes to the server at most this often. */
export const PROGRESS_INTERVAL_MS = 10_000;

/** `tick` is the video's `timeupdate` while playing; `leave` is `pagehide` or leaving the page in the app. */
export type ProgressTrigger = 'tick' | 'pause' | 'seeked' | 'leave' | 'ended';

export interface ProgressState {
  now: number;
  /** When the last PUT went out, or null before the first. */
  lastSentAt: number | null;
  positionMs: number;
  durationMs: number;
  /** The video has reached its end (a `pause` fires just before `ended`). */
  ended: boolean;
}

export type ProgressAction = 'put' | 'complete' | null;

/** Pure "when to send" rule: PUT every 10 s while playing and on pause, seek end and leave; POST complete on ended. */
export function progressAction(trigger: ProgressTrigger, state: ProgressState): ProgressAction {
  if (trigger === 'ended') return 'complete';
  // The update needs a known duration; a finished video is reported by `complete`, not by a late PUT.
  if (!Number.isFinite(state.durationMs) || state.durationMs <= 0 || state.ended) return null;
  if (!Number.isFinite(state.positionMs) || state.positionMs < 0) return null;
  if (trigger === 'tick') return state.lastSentAt === null || state.now - state.lastSentAt >= PROGRESS_INTERVAL_MS ? 'put' : null;
  return 'put';
}

/** Body of PUT /api/movies/:id/progress (integers, position within the duration). */
export function progressBody(positionMs: number, durationMs: number, shelfId?: number): PlaybackProgressUpdate {
  const duration = Math.max(1, Math.round(durationMs));
  const body: PlaybackProgressUpdate = { positionMs: Math.min(duration, Math.max(0, Math.round(positionMs))), durationMs: duration };
  if (shelfId !== undefined) body.shelfId = shelfId;
  return body;
}
