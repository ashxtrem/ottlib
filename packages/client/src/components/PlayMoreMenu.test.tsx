import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Movie } from '@ottlib/shared';
import { PlayMoreMenu, PlayMoreMenuList, playMoreEntries } from './PlayMoreMenu';
import { useIsLocalClient } from '../hooks/useIsLocalClient';

vi.mock('../hooks/useIsLocalClient', () => ({ useIsLocalClient: vi.fn() }));
vi.mock('../hooks/useToast', () => ({ useToast: () => ({ show: vi.fn() }) }));

const desktop = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142.0.0.0 Safari/537.36';
const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/142.0.0.0 Mobile Safari/537.36';
const quest = 'Mozilla/5.0 (X11; Linux x86_64; Quest 2) AppleWebKit/537.36 OculusBrowser/42.3.0.30.53 Chrome/142.0.7444.243 VR Safari/537.36';
const movie = { id: 3, title: 'Arrival' } as Movie;

const menuMarkup = (isLocal: boolean, userAgent: string) => renderToStaticMarkup(<PlayMoreMenuList entries={playMoreEntries(isLocal, userAgent)} label="More" onSelect={() => undefined} />);

describe('playMoreEntries', () => {
  it('always offers VLC, and nothing else on a plain remote browser', () => {
    expect(playMoreEntries(false, desktop)).toEqual(['vlc']);
  });

  it('adds the app handoff on Android and Quest browsers', () => {
    expect(playMoreEntries(false, android)).toEqual(['vlc', 'app']);
    expect(playMoreEntries(false, quest)).toEqual(['vlc', 'app']);
  });

  it('adds the server PC only for the local client', () => {
    expect(playMoreEntries(true, desktop)).toEqual(['vlc', 'server']);
    expect(playMoreEntries(true, android)).toEqual(['vlc', 'app', 'server']);
  });
});

describe('PlayMoreMenuList', () => {
  it('renders a menu with only the matching items', () => {
    const plain = menuMarkup(false, desktop);
    expect(plain).toContain('role="menu"');
    expect(plain).toContain('Open in VLC');
    expect(plain).not.toContain('Open in app');
    expect(plain).not.toContain('Play on the server PC');

    const phone = menuMarkup(false, android);
    expect(phone).toContain('Open in VLC');
    expect(phone).toContain('Open in app');
    expect(phone).not.toContain('Play on the server PC');

    const host = menuMarkup(true, desktop);
    expect(host).toContain('Open in VLC');
    expect(host).toContain('Play on the server PC');
    expect(host).not.toContain('Open in app');
  });
});

describe('PlayMoreMenu', () => {
  beforeEach(() => {
    vi.mocked(useIsLocalClient).mockReturnValue(false);
  });

  it('renders a closed 44px touch-target button', () => {
    const markup = renderToStaticMarkup(<PlayMoreMenu movie={movie} />);

    expect(markup).toContain('aria-haspopup="menu"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('h-11 w-11');
    expect(markup).not.toContain('role="menu"');
  });
});
