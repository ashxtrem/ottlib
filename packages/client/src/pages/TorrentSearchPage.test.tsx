import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const settings = vi.hoisted(() => ({ current: { torrentSearchEnabled: true, findProvider: 'hashlark' } }));
vi.mock('../hooks/useSettings', () => ({ useSettings: () => ({ data: settings.current }) }));

import { ToastProvider } from '../components/ToastProvider';
import { TorrentSearchPage } from './TorrentSearchPage';

const render = () => renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><ToastProvider><MemoryRouter><TorrentSearchPage /></MemoryRouter></ToastProvider></QueryClientProvider>);

describe('TorrentSearchPage', () => {
  it('shows the Hashlark panel, not the search or downloads, in Hashlark mode', () => {
    const markup = render();
    expect(markup).toContain('Find is set to Hashlark');
    expect(markup).toContain('>Open Hashlark</button>');
    expect(markup).toContain('href="/settings"');
    expect(markup).not.toContain('Torrent search</h1>');
  });

  it('says torrent search is off while Find is off', () => {
    settings.current = { torrentSearchEnabled: false, findProvider: 'hashlark' };
    expect(render()).toContain('Torrent search is off');
  });
});
