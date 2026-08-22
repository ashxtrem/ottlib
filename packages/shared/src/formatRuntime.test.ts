import { describe, expect, it } from 'vitest';
import { formatRuntime } from './index.js';

describe('formatRuntime', () => {
  it('formats metadata minutes as hours and minutes', () => {
    expect(formatRuntime(142)).toBe('2h 22m');
  });

  it('falls back to the probed duration when metadata has no runtime', () => {
    expect(formatRuntime(null, 7_260_123)).toBe('2h 1m');
  });

  it('returns null when neither source has a usable duration', () => {
    expect(formatRuntime(null, null)).toBeNull();
  });
});
