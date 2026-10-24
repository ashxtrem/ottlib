/** An `ended` this close to the end of the file is a real end. */
export const END_TOLERANCE_MS = 15_000;
/** A second `ended` this close to the position of the last false one is real: reopening didn't help, so stop looping. */
export const REPEAT_END_WINDOW_MS = 5_000;

/**
 * Whether an `ended` event is the end of the film. Native HLS on iPad Safari fires `ended` mid-file when the server
 * session is gone (every remaining segment 404s), with `currentTime` still at the play position.
 * `guardDurationMs` is the known full length of an HLS source; null (direct streams, unknown length) trusts the event.
 */
export function isRealEnd(positionMs: number, guardDurationMs: number | null, lastFalseEndMs: number | null): boolean {
  if (guardDurationMs === null || !Number.isFinite(guardDurationMs) || guardDurationMs <= 0) return true;
  if (positionMs >= guardDurationMs - END_TOLERANCE_MS) return true;
  return lastFalseEndMs !== null && Math.abs(positionMs - lastFalseEndMs) <= REPEAT_END_WINDOW_MS;
}

/** What WatchPage hands the three `ended` consumers: the length to check against and the last false end's position. */
export interface EndGuard {
  durationMs: number | null;
  lastFalseEnd: { current: number | null };
}

/** `isRealEnd` for a `<video>` at its current position. */
export function isRealVideoEnd(video: HTMLVideoElement, guard: EndGuard): boolean {
  return isRealEnd(video.currentTime * 1000, guard.durationMs, guard.lastFalseEnd.current);
}
