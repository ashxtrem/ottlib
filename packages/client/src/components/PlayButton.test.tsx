import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Movie } from '@ottlib/shared';
import { PlayButton, supportsExternalPlaybackHandoff } from './PlayButton';
import { useIsLocalClient } from '../hooks/useIsLocalClient';

vi.mock('../hooks/useIsLocalClient', () => ({ useIsLocalClient: vi.fn() }));
vi.mock('../hooks/useToast', () => ({ useToast: () => ({ show: vi.fn() }) }));

const movie = { id: 1, title: 'Arrival' } as Movie;
const isLocalClient = vi.mocked(useIsLocalClient);

describe('PlayButton', () => {
  beforeEach(() => {
    vi.stubGlobal('location', { origin: 'http://ottlib.test' });
  });

  it('renders a full-width Play label for the host machine', () => {
    isLocalClient.mockReturnValue(true);

    const markup = renderToStaticMarkup(<PlayButton movie={movie} />);

    expect(markup).toContain('w-full');
    expect(markup).toContain('>Play</span>');
    expect(markup).not.toContain('Play on this device');
  });

  it('uses the LAN-specific label and supports a compact variant', () => {
    isLocalClient.mockReturnValue(false);

    const markup = renderToStaticMarkup(<PlayButton movie={movie} variant="compact" />);

    expect(markup).toContain('Play on this device');
    expect(markup).toContain('h-10 w-10');
    expect(markup).toContain('sr-only');
  });

  it('uses an external-player handoff for current Quest Browser user agents', () => {
    expect(supportsExternalPlaybackHandoff('Mozilla/5.0 (X11; Linux x86_64; Quest 2) AppleWebKit/537.36 OculusBrowser/42.3.0.30.53 Chrome/142.0.7444.243 VR Safari/537.36')).toBe(true);
    expect(supportsExternalPlaybackHandoff('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142.0.0.0 Safari/537.36')).toBe(false);
  });
});
