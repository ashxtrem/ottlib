import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { MovieListItem } from '@ottlib/shared';
import { PosterCard } from './PosterCard';

const movie: MovieListItem = { id: 1, title: 'Arrival', year: 2016, posterUrl: null, resolution: null, hdrFormat: null, watched: false, metadataStatus: 'matched', shelves: [] };

function render(watched: boolean) {
  return renderToStaticMarkup(<MemoryRouter><PosterCard movie={{ ...movie, watched }} onToggleWatched={vi.fn()} /></MemoryRouter>);
}

describe('PosterCard watch state', () => {
  it('shows a persistent control for unwatched titles', () => {
    const markup = render(false);
    expect(markup).toContain('Mark Arrival as watched');
    expect(markup).toContain('opacity-100');
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
});
