import { describe, expect, it } from 'vitest';
import { artworkTintFromTitle } from './NoArtworkCard';

describe('artworkTintFromTitle', () => {
  it('gives each title a stable, valid tint', () => {
    expect(artworkTintFromTitle('Arrival')).toBe(artworkTintFromTitle('arrival'));
    expect(artworkTintFromTitle('Arrival')).not.toBe(artworkTintFromTitle('The Matrix'));
    expect(artworkTintFromTitle('Arrival')).toBeGreaterThanOrEqual(0);
    expect(artworkTintFromTitle('Arrival')).toBeLessThan(360);
  });
});
