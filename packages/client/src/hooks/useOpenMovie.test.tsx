import { renderToStaticMarkup } from 'react-dom/server';
import { Link, MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { movieLinkState, useOpenMovie } from './useOpenMovie';

function Probe({ shelfId }: { shelfId?: number }) {
  const open = useOpenMovie(7, shelfId);
  return <><Link to={open.to}>Details</Link><Link to={open.playTo}>Play</Link></>;
}

describe('useOpenMovie', () => {
  it('links the details page and scopes Play to the shelf', () => {
    const shelf = renderToStaticMarkup(<MemoryRouter><Probe shelfId={9} /></MemoryRouter>);
    expect(shelf).toContain('href="/movie/7"');
    expect(shelf).toContain('href="/watch/7?shelf=9"');
    expect(renderToStaticMarkup(<MemoryRouter><Probe /></MemoryRouter>)).toContain('href="/watch/7"');
  });

  it('carries the shelf scope in the link state only from a shelf', () => {
    expect(movieLinkState(9)).toEqual({ fromShelf: true, shelfId: 9 });
    expect(movieLinkState()).toBeUndefined();
  });
});
