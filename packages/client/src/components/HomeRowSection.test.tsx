import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { MovieListItem } from '@ottlib/shared';
import type { HomeRow } from '../hooks/useHomeRows';
import { HomeRowSection, rowPlaceholderClass } from './HomeRowSection';
import { ToastProvider } from './ToastProvider';

const movie: MovieListItem = { id: 1, title: 'Arrival', year: 2016, posterUrl: null, resolution: null, hdrFormat: null, watched: false, resumePositionMs: null, durationMs: null, missing: false, metadataStatus: 'matched', shelves: [], showKey: null, fresh: null };
const row: HomeRow = { key: 'recent', title: 'Recently added', items: [movie, { ...movie, id: 2, title: 'Dune' }] };

function render(index: number) {
  return renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><ToastProvider><MemoryRouter><HomeRowSection row={row} index={index} restoreOffset={false} /></MemoryRouter></ToastProvider></QueryClientProvider>);
}

describe('HomeRowSection', () => {
  it('renders the first rows straight away', () => {
    const markup = render(2);
    expect(markup).toContain('Recently added');
    expect(markup).toContain('Mark Dune as watched');
    expect(markup).toContain('snap-x');
  });

  it('holds a fixed-height placeholder for rows past the third until they come near', () => {
    const markup = render(3);
    expect(markup).not.toContain('Recently added');
    expect(markup).not.toContain('Arrival');
    expect(markup).toContain(rowPlaceholderClass);
    expect(markup).toContain('aria-hidden="true"');
  });
});
