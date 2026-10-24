import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { Movie } from '@ottlib/shared';
import { NextTitlePanel } from './NextTitlePanel';

const episode = (id: number, season: number, number: number) => ({ id, title: `Show S${season}E${number}`, mediaType: 'tv', season, episode: number }) as Movie;
const render = (current: Movie, next: Movie, shelfId?: number) => renderToStaticMarkup(<MemoryRouter><NextTitlePanel current={current} next={next} shelfId={shelfId} /></MemoryRouter>).replaceAll('<!-- -->', '');

describe('NextTitlePanel', () => {
  it('names the next episode and plays it in the browser player', () => {
    const markup = render(episode(1, 1, 1), episode(2, 1, 2));

    expect(markup).toContain('>Next episode: <a ');
    expect(markup).toContain('href="/movie/2" data-discover="true">Show S1E2</a>');
    expect(markup).toContain('href="/watch/2"');
    expect(markup).toContain('Play next');
    expect(markup).not.toContain('Some episodes are unavailable');
  });

  it('notes skipped episodes', () => {
    expect(render(episode(1, 1, 1), episode(5, 1, 4))).toContain('Some episodes are unavailable. Next available: S1E4.');
  });

  it('keeps the shelf for the next movie of a shelf', () => {
    const markup = render({ id: 3, title: 'Alien', mediaType: 'movie' } as Movie, { id: 4, title: 'Aliens', mediaType: 'movie' } as Movie, 9);

    expect(markup).toContain('>Up next: <a ');
    expect(markup).toContain('href="/movie/4" data-discover="true">Aliens</a>');
    expect(markup).toContain('href="/watch/4?shelf=9"');
  });
});
