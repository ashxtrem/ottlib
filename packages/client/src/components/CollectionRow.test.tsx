import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { FindMode, MovieCollection, MovieListItem } from '@ottlib/shared';
import { CollectionRowView } from './CollectionRow';

const owned: MovieListItem = { id: 1, title: 'Dune', year: 2021, posterUrl: null, resolution: null, hdrFormat: null, watched: false, resumePositionMs: null, durationMs: null, missing: false, metadataStatus: 'matched', shelves: [], showKey: null, fresh: null };
const collection: MovieCollection = { id: 9, name: 'Dune Collection', owned: [owned], missing: [{ tmdbId: '693134', title: 'Dune: Part Two', year: 2024, posterUrl: null }] };

const render = (findMode: FindMode, value: MovieCollection = collection) => renderToStaticMarkup(<MemoryRouter><CollectionRowView collection={value} currentId={1} findMode={findMode} /></MemoryRouter>);

describe('CollectionRow', () => {
  it('shows "Part of" with owned titles as linked cards', () => {
    const markup = render('off');

    expect(markup).toContain('Part of Dune Collection');
    expect(markup).toContain('href="/movie/1"');
    expect(markup).toContain('overflow-x-auto');
  });

  it('dims a missing film with its year', () => {
    const markup = render('off');

    expect(markup).toContain('data-missing-part');
    expect(markup).toContain('opacity-40');
    expect(markup).toContain('Dune: Part Two');
    expect(markup).toContain('2024');
  });

  it('links a missing film to torrent search only in qBittorrent mode', () => {
    expect(render('qbittorrent')).toContain('href="/torrents?q=Dune%3A%20Part%20Two&amp;year=2024"');
    expect(render('qbittorrent')).toContain('aria-label="Find Dune: Part Two"');
    expect(render('off')).not.toContain('/torrents');
    expect(render('off')).not.toContain('Find Dune');
  });

  it('renders nothing for an empty collection', () => {
    expect(render('qbittorrent', { ...collection, owned: [], missing: [] })).toBe('');
  });
});
