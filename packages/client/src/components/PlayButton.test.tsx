import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Movie } from '@ottlib/shared';
import { PlayButton } from './PlayButton';
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
});
