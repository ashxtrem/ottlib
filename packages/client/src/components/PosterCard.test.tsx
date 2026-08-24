import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { MovieListItem } from '@ottlib/shared';
import { PosterCard } from './PosterCard';

const movie: MovieListItem = { id: 1, title: 'Arrival', year: 2016, posterUrl: null, resolution: null, hdrFormat: null, watched: false, missing: false, metadataStatus: 'matched', shelves: [] };

function render(watched: boolean) {
  return renderToStaticMarkup(<MemoryRouter><PosterCard movie={{ ...movie, watched }} onToggleWatched={vi.fn()} /></MemoryRouter>);
}

describe('PosterCard watch state', () => {
  it('shows a persistent control for unwatched titles', () => {
    const markup = render(false);
    expect(markup).toContain('Mark Arrival as watched');
    expect(markup).toContain('opacity-100');
    expect(markup).toContain('absolute bottom-3 right-3');
  });

  it('places selection and watch controls at opposing bottom corners', () => {
    const markup = renderToStaticMarkup(<MemoryRouter><PosterCard movie={movie} selected onSelectedChange={vi.fn()} onToggleWatched={vi.fn()} /></MemoryRouter>);

    expect(markup).toContain('absolute bottom-3 left-3');
    expect(markup).toContain('absolute bottom-3 right-3');
    expect(markup).toContain('flex h-full flex-col');
    expect(markup).toContain('flex flex-1 flex-col');
    expect(markup).not.toContain('right-3 top-7');
  });

  it('shows a check treatment and dimmed poster for watched titles', () => {
    const markup = render(true);
    expect(markup).toContain('Mark Arrival as unwatched');
    expect(markup).toContain('opacity-70');
    expect(markup).toContain('Watched');
  });

  it('marks 4K HDR titles on the poster image', () => {
    const markup = renderToStaticMarkup(<MemoryRouter><PosterCard movie={{ ...movie, resolution: '4K', hdrFormat: 'HDR10' }} onToggleWatched={vi.fn()} /></MemoryRouter>);
    expect(markup).toContain('4K');
    expect(markup).toContain('HDR');
  });

  it('marks unavailable titles on the poster image', () => {
    const markup = renderToStaticMarkup(<MemoryRouter><PosterCard movie={{ ...movie, missing: true }} onToggleWatched={vi.fn()} /></MemoryRouter>);
    expect(markup).toContain('Unavailable');
  });

  it('wraps long titles using a smaller two-line caption', () => {
    const markup = renderToStaticMarkup(<MemoryRouter><PosterCard movie={{ ...movie, title: 'Absolutely Anything With An Extra Long Subtitle' }} onToggleWatched={vi.fn()} /></MemoryRouter>);

    expect(markup).toContain('line-clamp-2');
    expect(markup).toContain('text-sm');
    expect(markup).not.toContain('truncate font-medium text-foreground');
  });
});
