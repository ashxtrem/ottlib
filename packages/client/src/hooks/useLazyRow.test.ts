import { describe, expect, it } from 'vitest';
import { eagerRowCount, isEagerRow, lazyRowMargin } from './useLazyRow';

describe('lazy home rows', () => {
  it('renders the first three rows at once', () => {
    expect(eagerRowCount).toBe(3);
    expect([0, 1, 2].every(isEagerRow)).toBe(true);
    expect(isEagerRow(3)).toBe(false);
    expect(isEagerRow(10)).toBe(false);
  });

  it('starts rendering a row within 1.5 screens', () => {
    expect(lazyRowMargin).toBe('150% 0px');
  });
});
