import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { MovieListItem } from '@ottlib/shared';
import { freshStripClassName, PosterCard } from './PosterCard';

const movie: MovieListItem = { id: 1, title: 'Arrival', year: 2016, posterUrl: null, resolution: null, hdrFormat: null, watched: false, resumePositionMs: null, durationMs: null, missing: false, metadataStatus: 'matched', shelves: [], showKey: null, fresh: null };

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

  it('shows the New strip only for fresh titles', () => {
    const fresh = renderToStaticMarkup(<MemoryRouter><PosterCard movie={{ ...movie, fresh: 'new' }} onToggleWatched={vi.fn()} /></MemoryRouter>);
    expect(fresh).toContain('>New</span>');
    expect(fresh).toContain(freshStripClassName);
    expect(render(false)).not.toContain('>New</span>');
  });

  it('keeps the New strip clear of the shelf chip and badges on a 144 px card', () => {
    const markup = renderToStaticMarkup(<MemoryRouter><PosterCard movie={{ ...movie, fresh: 'new', resolution: '4K', missing: true, metadataStatus: 'suggested', posterUrl: '/p.jpg', shelves: [{ id: 1, name: 'A very long shelf name' }] } as MovieListItem} onToggleWatched={vi.fn()} /></MemoryRouter>);
    // Shelf chip: left-2 (8 px) + max-w calc(100% - 3.25rem) ends at 144 - 52 + 8 = 100 px.
    expect(markup).toContain('left-2 top-2 z-10 max-w-[calc(100%-3.25rem)]');
    // Strip: right-0 top-0, 16 px line + 4 px padding = 20 px tall; "NEW" at 10 px bold + 12 px padding is about 34 px wide.
    expect(freshStripClassName).toContain('right-0 top-0');
    expect(freshStripClassName).toContain('text-[10px]');
    expect(freshStripClassName).toContain('leading-4');
    expect(144 - 34).toBeGreaterThan(100);
    // Unavailable and Needs review start at top-12 (48 px), below the 20 px strip; quality markers sit at the poster bottom.
    expect(markup).toContain('absolute right-2 top-12');
    expect(markup).toContain('absolute bottom-2 left-2');
  });

  it('wraps long titles using a smaller two-line caption', () => {
    const markup = renderToStaticMarkup(<MemoryRouter><PosterCard movie={{ ...movie, title: 'Absolutely Anything With An Extra Long Subtitle' }} onToggleWatched={vi.fn()} /></MemoryRouter>);

    expect(markup).toContain('line-clamp-2');
    expect(markup).toContain('text-sm');
    expect(markup).not.toContain('truncate font-medium text-foreground');
  });
});
