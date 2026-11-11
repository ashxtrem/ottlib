import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { FindButton } from './FindButton';
import { ToastProvider } from './ToastProvider';

const render = (node: ReactNode) => renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><ToastProvider><MemoryRouter>{node}</MemoryRouter></ToastProvider></QueryClientProvider>);
const query = { title: 'Heat & Dust', year: 1983, imdbId: 'tt0085672' };

describe('FindButton', () => {
  it('renders nothing while Find is off', () => {
    expect(render(<FindButton mode="off" query={query} label="Find this" className="btn" />)).not.toContain('Find this');
    expect(render(<FindButton mode="off" label="Search torrents" className="btn" />)).not.toContain('<a');
  });

  it('links to the in-app torrent search in qBittorrent mode, as before', () => {
    expect(render(<FindButton mode="qbittorrent" query={query} label="Find this" className="btn" />)).toContain('<a class="btn" href="/torrents?q=Heat%20%26%20Dust&amp;year=1983" data-discover="true">Find this</a>');
    expect(render(<FindButton mode="qbittorrent" query={{ title: 'Up', year: null }} label="Find" className="btn" />)).toContain('href="/torrents?q=Up"');
    const floating = render(<FindButton mode="qbittorrent" label="Search torrents" title="Torrent search" icon={<svg />} className="btn" />);
    expect(floating).toContain('href="/torrents"');
    expect(floating).toContain('aria-label="Search torrents"');
    expect(floating).toContain('title="Torrent search"');
  });

  it('hands off to Hashlark in Hashlark mode, keeping the label and style', () => {
    const markup = render(<FindButton mode="hashlark" query={query} label="Find this" className="btn" />);
    expect(markup).toMatch(/^<button type="button" class="btn [^"]*">Find this<\/button>/);
    expect(markup).not.toContain('/torrents');
  });

  it('reads "Open Hashlark" on buttons with no title', () => {
    const floating = render(<FindButton mode="hashlark" label="Search torrents" title="Torrent search" icon={<svg />} className="btn" />);
    expect(floating).toContain('aria-label="Open Hashlark"');
    expect(floating).toContain('<span class="sr-only">Open Hashlark</span>');
    expect(floating).not.toContain('Search torrents');
    expect(render(<FindButton mode="hashlark" label="Search torrents" className="btn" />)).toContain('>Open Hashlark</button>');
  });
});
