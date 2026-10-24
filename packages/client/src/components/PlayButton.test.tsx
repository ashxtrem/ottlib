import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { Movie } from '@ottlib/shared';
import { formatResumePosition, PlayButton, playLabel, supportsExternalPlaybackHandoff } from './PlayButton';

const movie = { id: 7, title: 'Arrival', resumePositionMs: null } as Movie;
const render = (item: Movie, variant?: 'primary' | 'compact') => renderToStaticMarkup(<MemoryRouter><PlayButton movie={item} variant={variant} /></MemoryRouter>);

describe('PlayButton', () => {
  it('links a full-width Play button to the browser player', () => {
    const markup = render(movie);

    expect(markup).toContain('href="/watch/7"');
    expect(markup).toContain('w-full');
    expect(markup).toContain('>Play</span>');
    expect(markup).not.toContain('Play on this device');
  });

  it('labels the button Resume with the saved position', () => {
    const markup = render({ ...movie, resumePositionMs: 2_480_000 });

    expect(markup).toContain('>Resume 41:20</span>');
    expect(markup).toContain('href="/watch/7"');
  });

  it('supports a compact variant with a screen-reader label', () => {
    const markup = render(movie, 'compact');

    expect(markup).toContain('h-10 w-10');
    expect(markup).toContain('sr-only');
  });

  it('formats resume positions as m:ss, or h:mm:ss over an hour', () => {
    expect(formatResumePosition(2_480_000)).toBe('41:20');
    expect(formatResumePosition(3_909_000)).toBe('1:05:09');
    expect(formatResumePosition(5_000)).toBe('0:05');
    expect(playLabel(null)).toBe('Play');
    expect(playLabel(0)).toBe('Play');
    expect(playLabel(3_909_000)).toBe('Resume 1:05:09');
  });

  it('uses an external-player handoff for current Quest Browser user agents', () => {
    expect(supportsExternalPlaybackHandoff('Mozilla/5.0 (X11; Linux x86_64; Quest 2) AppleWebKit/537.36 OculusBrowser/42.3.0.30.53 Chrome/142.0.7444.243 VR Safari/537.36')).toBe(true);
    expect(supportsExternalPlaybackHandoff('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142.0.0.0 Safari/537.36')).toBe(false);
  });
});
