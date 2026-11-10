import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { TrailerDialog } from './TrailerDialog';

describe('TrailerDialog', () => {
  it('embeds the youtube-nocookie trailer while open', () => {
    const markup = renderToStaticMarkup(<TrailerDialog trailerKey="tFMo3UJ4B4g" title="Arrival" open onClose={vi.fn()} />);

    expect(markup).toContain('<iframe');
    expect(markup).toContain('src="https://www.youtube-nocookie.com/embed/tFMo3UJ4B4g?autoplay=1"');
    expect(markup).toContain('aspect-video');
  });

  it('has no iframe while closed', () => {
    const markup = renderToStaticMarkup(<TrailerDialog trailerKey="tFMo3UJ4B4g" title="Arrival" open={false} onClose={vi.fn()} />);

    expect(markup).not.toContain('<iframe');
  });
});
