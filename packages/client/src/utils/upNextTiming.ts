/** The next episode is shown when this much of the current one is left (no early start at the credits). */
export const UP_NEXT_LEAD_MS = 20_000;
/** After the end (or from the credits start), the next episode starts after this countdown unless cancelled. */
export const UP_NEXT_COUNTDOWN_MS = 10_000;

export type UpNextPhase =
  | { kind: 'hidden' }
  | { kind: 'preview' }
  | { kind: 'countdown'; secondsLeft: number }
  | { kind: 'advance' };

export interface UpNextInput {
  hasNext: boolean;
  /** Cancel keeps the viewer on the finished episode: nothing more is shown. */
  cancelled: boolean;
  positionMs: number;
  /** NaN or 0 while unknown. */
  durationMs: number;
  /** When the countdown began: `ended` fired, or the position reached `startAtMs`. Null while neither holds. */
  endedAtMs: number | null;
  nowMs: number;
  /** Position where the countdown starts early (the credits, with auto-skip on); null or absent: the 20 s lead. */
  startAtMs?: number | null;
}

/** Whether the position has reached the early countdown start. */
export function reachedStartAt(positionMs: number, startAtMs: number | null | undefined): boolean {
  return startAtMs !== null && startAtMs !== undefined && positionMs >= startAtMs;
}

/**
 * The countdown start after a tick from `lastTickMs` to `nowMs`. The early (credits) countdown holds while the video is
 * paused, so its start moves forward by the paused time; the countdown after the end always runs.
 */
export function heldCountdownStart(endedAtMs: number, lastTickMs: number, nowMs: number, hold: boolean): number {
  return hold ? endedAtMs + Math.max(0, nowMs - lastTickMs) : endedAtMs;
}

/**
 * Hidden → preview at 20 s left → a 10 s countdown after the end → advance to the next one.
 * With `startAtMs`, no preview: the 10 s countdown runs from the moment the position reaches it.
 */
export function upNextPhase({ hasNext, cancelled, positionMs, durationMs, endedAtMs, nowMs, startAtMs }: UpNextInput): UpNextPhase {
  if (!hasNext || cancelled) return { kind: 'hidden' };
  if (endedAtMs !== null) {
    const leftMs = UP_NEXT_COUNTDOWN_MS - Math.max(0, nowMs - endedAtMs);
    return leftMs <= 0 ? { kind: 'advance' } : { kind: 'countdown', secondsLeft: Math.ceil(leftMs / 1000) };
  }
  if (startAtMs !== null && startAtMs !== undefined) return { kind: 'hidden' };
  if (Number.isFinite(durationMs) && durationMs > 0 && durationMs - positionMs <= UP_NEXT_LEAD_MS) return { kind: 'preview' };
  return { kind: 'hidden' };
}
