/** The position holder behind `useHeldPosition`: a plain object so the rule is testable without React. */
export interface PositionHold {
  ms: number;
}

/**
 * The position to act on. While the seek bar is being dragged it is the position from just before the drag (a direct-play
 * drag moves the real video, which would otherwise cross the credits start or the end mid-drag); otherwise the live one.
 */
export function heldPosition(hold: PositionHold, scrubbing: boolean, liveMs: number): number {
  if (!scrubbing) hold.ms = liveMs;
  return hold.ms;
}
