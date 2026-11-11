import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { Movie } from '@ottlib/shared';
import { MovieActionButtons } from './MovieActionButtons';

vi.mock('./PlayButton', () => ({ PlayButton: () => null }));
vi.mock('./PlayMoreMenu', () => ({ PlayMoreMenu: () => null }));
vi.mock('./RevealInFolderButton', () => ({ RevealInFolderButton: () => null }));
const findMode = vi.hoisted(() => ({ current: 'off' as 'off' | 'qbittorrent' | 'hashlark' }));
vi.mock('../hooks/useFindMode', () => ({ useFindMode: () => findMode.current }));

const movie = { id: 7, title: 'Arrival', year: 2016, resumePositionMs: null, watched: false, missing: false, showKey: null, trailerKey: null } as Movie;

function render(item: Movie) {
  return renderToStaticMarkup(<MemoryRouter>
    <MovieActionButtons imdbUrl="https://www.imdb.com/" movie={item} onManageShelves={vi.fn()} onSubtitles={vi.fn()} onToggleWatched={vi.fn()} watchPending={false} hidden={false} onToggleHidden={vi.fn()} onTrailer={vi.fn()} />
  </MemoryRouter>);
}

describe('MovieActionButtons trailer', () => {
  it('shows a Trailer button when the title has a trailer', () => {
    expect(render({ ...movie, trailerKey: 'abc' })).toContain('>Trailer</button>');
  });

  it('has no Trailer button without one', () => {
    expect(render(movie)).not.toContain('>Trailer</button>');
  });
});

describe('MovieActionButtons Find', () => {
  it('links to torrent search in qBittorrent mode and hides Find while it is off', () => {
    findMode.current = 'qbittorrent';
    expect(render(movie)).toContain('href="/torrents?q=Arrival&amp;year=2016"');
    expect(render({ ...movie, missing: true })).toContain('>Find replacement</a>');
    findMode.current = 'off';
    expect(render(movie)).not.toContain('Find this');
  });
});
