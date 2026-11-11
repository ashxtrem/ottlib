import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import type { FindProvider, Settings } from '@ottlib/shared';
import { describe, expect, it, vi } from 'vitest';

const findStatus = vi.hoisted(() => ({ current: { data: { mode: 'qbittorrent', hashlarkAvailable: true } as { mode: string; hashlarkAvailable: boolean } | undefined, isLoading: false, error: null } }));
vi.mock('../hooks/useFindStatus', () => ({ useFindStatus: () => findStatus.current }));

import { FindSettingsSection } from './FindSettingsSection';
import { ToastProvider } from './ToastProvider';

const settings = { torrentSearchEnabled: true, findProvider: 'qbittorrent', qbittorrentUrl: '', qbittorrentUsername: '', qbittorrentPassword: '', qbittorrentCategory: 'ottlib', qbittorrentSavePath: '', torrentPreferredResolution: null, torrentPreferredCodec: null, torrentMaxSizeGb: null } as unknown as Settings;

function render(enabled: boolean, provider: FindProvider, saved: Partial<Settings> = {}) {
  return renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><ToastProvider><MemoryRouter>
    <FindSettingsSection settings={{ ...settings, ...saved }} enabled={enabled} onEnabledChange={vi.fn()} provider={provider} onProviderChange={vi.fn()} qbittorrent={{ testing: false, onTest: vi.fn() }} />
  </MemoryRouter></ToastProvider></QueryClientProvider>);
}

describe('FindSettingsSection', () => {
  it('shows only the on/off switch while Find is off', () => {
    const markup = render(false, 'qbittorrent');
    expect(markup).toContain('Find and torrent search');
    expect(markup).not.toContain('Find with');
    expect(markup).not.toContain('qbittorrentUrl');
  });

  it('shows the "Find with" choice and the qBittorrent fields with qBittorrent', () => {
    const markup = render(true, 'qbittorrent');
    expect(markup).toContain('Find with');
    expect(markup).toMatch(/checked="" value="qbittorrent"/);
    expect(markup).toContain('name="qbittorrentUrl"');
    expect(markup).not.toContain('Open Hashlark');
  });

  it('shows the Hashlark status instead of the qBittorrent fields with Hashlark', () => {
    const markup = render(true, 'hashlark', { findProvider: 'hashlark' });
    expect(markup).toMatch(/checked="" value="hashlark"/);
    expect(markup).not.toContain('qbittorrentUrl');
    expect(markup).toContain('Hashlark found on the server PC');
    expect(markup).toMatch(/<button type="button" class="[^"]*">Open Hashlark<\/button>/);
  });

  it('says Hashlark is missing, and keeps Open Hashlark disabled until Hashlark mode is saved', () => {
    findStatus.current = { ...findStatus.current, data: { mode: 'qbittorrent', hashlarkAvailable: false } };
    const markup = render(true, 'hashlark');
    expect(markup).toContain('Not found. Install Hashlark on the server PC.');
    expect(markup).toMatch(/<button type="button" disabled="" class="[^"]*">Open Hashlark<\/button>/);
    expect(markup).toContain('Save settings to use Hashlark first.');
  });
});
