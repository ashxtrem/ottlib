/** The next episode is shown when this much of the current one is left. */
export const UP_NEXT_LEAD_MS = 20_000;
/** After the end, the next episode starts after this countdown unless cancelled. */
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
  /** When `ended` fired; null while playing or after seeking back. */
  endedAtMs: number | null;
  nowMs: number;
}

/** Hidden → preview at 20 s left → a 10 s countdown after the end → advance to the next one. */
export function upNextPhase({ hasNext, cancelled, positionMs, durationMs, endedAtMs, nowMs }: UpNextInput): UpNextPhase {
  if (!hasNext || cancelled) return { kind: 'hidden' };
  if (endedAtMs !== null) {
    const leftMs = UP_NEXT_COUNTDOWN_MS - Math.max(0, nowMs - endedAtMs);
    return leftMs <= 0 ? { kind: 'advance' } : { kind: 'countdown', secondsLeft: Math.ceil(leftMs / 1000) };
  }
  if (Number.isFinite(durationMs) && durationMs > 0 && durationMs - positionMs <= UP_NEXT_LEAD_MS) return { kind: 'preview' };
  return { kind: 'hidden' };
}
