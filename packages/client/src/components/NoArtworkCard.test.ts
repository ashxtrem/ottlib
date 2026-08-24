import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NoArtworkCard, artworkTintFromTitle } from './NoArtworkCard';

describe('artworkTintFromTitle', () => {
  it('gives each title a stable, valid tint', () => {
    expect(artworkTintFromTitle('Arrival')).toBe(artworkTintFromTitle('arrival'));
    expect(artworkTintFromTitle('Arrival')).not.toBe(artworkTintFromTitle('The Matrix'));
    expect(artworkTintFromTitle('Arrival')).toBeGreaterThanOrEqual(0);
    expect(artworkTintFromTitle('Arrival')).toBeLessThan(360);
  });

  it('uses a smaller title size for long poster names', () => {
    const shortTitle = renderToStaticMarkup(createElement(NoArtworkCard, { title: 'Arrival', year: 2016, status: 'unmatched' }));
    const longTitle = renderToStaticMarkup(createElement(NoArtworkCard, { title: 'The Incredibly Long Movie Title That Needs More Room On Its Poster', year: 2016, status: 'unmatched' }));

    expect(shortTitle).toContain('text-2xl');
    expect(longTitle).toContain('text-base');
  });
});
