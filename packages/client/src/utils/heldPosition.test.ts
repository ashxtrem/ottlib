import { describe, expect, it } from 'vitest';
import { heldPosition } from './heldPosition';

describe('heldPosition', () => {
  it('follows the live position when not scrubbing', () => {
    const hold = { ms: 0 };
    expect(heldPosition(hold, false, 5000)).toBe(5000);
    expect(heldPosition(hold, false, 6000)).toBe(6000);
  });

  it('keeps the pre-drag position while scrubbing, then follows again after release', () => {
    const hold = { ms: 0 };
    expect(heldPosition(hold, false, 5000)).toBe(5000);
    expect(heldPosition(hold, true, 900_000)).toBe(5000);
    expect(heldPosition(hold, true, 1_400_000)).toBe(5000);
    expect(heldPosition(hold, false, 1_400_000)).toBe(1_400_000);
  });
});
