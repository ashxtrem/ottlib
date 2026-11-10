import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { formatOutsideRating, RatingsStrip } from './RatingsStrip';

describe('RatingsStrip', () => {
  it('shows IMDb, Rotten Tomatoes and Metacritic in that order', () => {
    const markup = renderToStaticMarkup(<RatingsStrip fallback={7.2} ratings={[
      { source: 'metacritic', value: 81, max: 100 },
      { source: 'imdb', value: 7.9, max: 10 },
      { source: 'rottenTomatoes', value: 94, max: 100 }
    ]} />);

    expect(markup).toContain('7.9/10');
    expect(markup).toContain('94%');
    expect(markup).toContain('81/100');
    expect(markup.indexOf('IMDb')).toBeLessThan(markup.indexOf('Rotten Tomatoes'));
    expect(markup.indexOf('Rotten Tomatoes')).toBeLessThan(markup.indexOf('Metacritic'));
    expect(markup).not.toContain('★');
  });

  it('falls back to the single ★ value when the list is empty', () => {
    const markup = renderToStaticMarkup(<RatingsStrip ratings={[]} fallback={7.23} />);

    expect(markup).toContain('★ 7.2');
    expect(markup).not.toContain('IMDb');
  });

  it('renders nothing with no ratings at all', () => {
    expect(renderToStaticMarkup(<RatingsStrip ratings={[]} fallback={null} />)).toBe('');
  });

  it('formats each source', () => {
    expect(formatOutsideRating({ source: 'imdb', value: 8, max: 10 })).toBe('8.0/10');
    expect(formatOutsideRating({ source: 'rottenTomatoes', value: 61.6, max: 100 })).toBe('62%');
  });
});
