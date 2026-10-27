import { useRef } from 'react';
import { heldPosition } from '../utils/heldPosition';

/** `liveMs`, except that during a scrub it stays at the pre-drag position (see `heldPosition`). */
export function useHeldPosition(liveMs: number, scrubbing: boolean): number {
  const hold = useRef({ ms: liveMs });
  return heldPosition(hold.current, scrubbing, liveMs);
}
