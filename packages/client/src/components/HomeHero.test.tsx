import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { Movie, MovieListItem } from '@ottlib/shared';
import type { HomeHeroData } from '../hooks/useHomeHero';
import { HomeHero, timeLeftLabel } from './HomeHero';

const item: MovieListItem = { id: 7, title: 'Arrival', year: 2016, posterUrl: null, resolution: null, hdrFormat: null, watched: false, resumePositionMs: null, durationMs: 116 * 60_000, missing: false, metadataStatus: 'matched', shelves: [], showKey: null, fresh: null };
const movie = {
  id: 7, title: 'Arrival', year: 2016, overview: 'A linguist is recruited to talk to visitors.', backdropUrl: '/media/backdrops/7.jpg', logoUrl: null, runtime: 116, resumePositionMs: null, mediaInfo: null
} as unknown as Movie;

function render(hero: HomeHeroData | null) {
  return renderToStaticMarkup(<MemoryRouter><HomeHero hero={hero} /></MemoryRouter>);
}

describe('HomeHero', () => {
  it('renders nothing without a featured title', () => {
    expect(render(null)).toBe('');
  });

  it('shows a skeleton of the hero height while details load', () => {
    const markup = render({ item, movie: undefined, isLoading: true });
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('md:h-[26rem]');
    expect(markup).toContain('aspect-video');
  });

  it('shows backdrop, title, meta, overview, Play and Details', () => {
    const markup = render({ item, movie, isLoading: false });
    expect(markup).toContain('src="/media/backdrops/7.jpg"');
    expect(markup).toContain('>Arrival</h2>');
    expect(markup).toContain('2016 · 1h 56m');
    expect(markup).toContain('line-clamp-2');
    expect(markup).toContain('md:line-clamp-3');
    expect(markup).toContain('href="/watch/7"');
    expect(markup).toContain('<span>Play</span>');
    expect(markup).toContain('href="/movie/7"');
    expect(markup).toContain('text-on-art');
    expect(markup).toContain('md:bg-gradient-to-r');
  });

  it('uses the logo in place of the title text when set', () => {
    const markup = render({ item, movie: { ...movie, logoUrl: '/media/logos/7.png' }, isLoading: false });
    expect(markup).toContain('src="/media/logos/7.png" alt="Arrival"');
    expect(markup).not.toContain('>Arrival</h2>');
  });

  it('offers Resume to /watch/:id with the time left when resuming', () => {
    const resuming = { ...item, resumePositionMs: 74 * 60_000 };
    const markup = render({ item: resuming, movie: { ...movie, resumePositionMs: 74 * 60_000 }, isLoading: false });
    expect(markup).toContain('<span>Resume</span>');
    expect(markup).toContain('href="/watch/7"');
    expect(markup).toContain('42 min left');
  });
});

describe('timeLeftLabel', () => {
  it('formats minutes and hours, null when not resuming', () => {
    expect(timeLeftLabel(30 * 60_000, 72 * 60_000)).toBe('42 min left');
    expect(timeLeftLabel(60_000, 66 * 60_000)).toBe('1 h 5 min left');
    expect(timeLeftLabel(null, 66 * 60_000)).toBeNull();
    expect(timeLeftLabel(60_000, null)).toBeNull();
    expect(timeLeftLabel(70 * 60_000, 60 * 60_000)).toBeNull();
  });
});
