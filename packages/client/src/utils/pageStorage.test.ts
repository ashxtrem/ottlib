import { describe, expect, it } from 'vitest';
import { memoryStorage, pageStorage, safeStorage } from './pageStorage';

describe('pageStorage', () => {
  it('has no browser store to hand out when storage is blocked, yet a write still reads back for the session', () => {
    // The node test environment has no `window`, which is the same failure as a SecurityError on access.
    expect(safeStorage()).toBeNull();
    pageStorage().setItem('k', 'v');
    expect(pageStorage().getItem('k')).toBe('v');
  });

  it('memoryStorage reads back what it was given and can be cleared', () => {
    const memory = memoryStorage();
    memory.setItem('a', '1');
    expect(memory.getItem('a')).toBe('1');
    memory.clear();
    expect(memory.getItem('a')).toBeNull();
  });
});
