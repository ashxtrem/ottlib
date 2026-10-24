import { describe, expect, it } from 'vitest';
import { columnsFromTops, initialTileIndex, nextTileIndex } from './tileFocus';

describe('nextTileIndex', () => {
  it('moves left and right within bounds', () => {
    expect(nextTileIndex(0, 'ArrowRight', 3, 3)).toBe(1);
    expect(nextTileIndex(2, 'ArrowRight', 3, 3)).toBeNull();
    expect(nextTileIndex(0, 'ArrowLeft', 3, 3)).toBeNull();
  });

  it('moves by a row up and down, landing on the last tile of a shorter row', () => {
    expect(nextTileIndex(1, 'ArrowDown', 6, 4)).toBe(5);
    expect(nextTileIndex(3, 'ArrowDown', 6, 4)).toBe(5);
    expect(nextTileIndex(5, 'ArrowUp', 6, 4)).toBe(1);
    expect(nextTileIndex(4, 'ArrowDown', 6, 4)).toBeNull();
    expect(nextTileIndex(1, 'ArrowUp', 6, 4)).toBeNull();
  });

  it('jumps with Home and End and ignores other keys', () => {
    expect(nextTileIndex(3, 'Home', 6, 4)).toBe(0);
    expect(nextTileIndex(0, 'End', 6, 4)).toBe(5);
    expect(nextTileIndex(0, 'Enter', 6, 4)).toBeNull();
    expect(nextTileIndex(0, 'ArrowRight', 0, 4)).toBeNull();
  });
});

describe('columnsFromTops', () => {
  it('counts the tiles on the first row', () => {
    expect(columnsFromTops([10, 10, 10, 150, 150])).toBe(3);
    expect(columnsFromTops([10, 150])).toBe(1);
    expect(columnsFromTops([])).toBe(1);
  });
});

describe('initialTileIndex', () => {
  it('focuses the last used profile, else the first', () => {
    expect(initialTileIndex([4, 7, 9], 7)).toBe(1);
    expect(initialTileIndex([4, 7, 9], 2)).toBe(0);
    expect(initialTileIndex([4, 7, 9], null)).toBe(0);
  });
});
