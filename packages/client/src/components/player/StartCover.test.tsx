import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StartCover, type StartCoverSource } from './StartCover';

const source: StartCoverSource = { framePreviewUrl: '/api/movies/7/frame?key=abc', durationMs: 7_200_000 };
const render = (props: Partial<Parameters<typeof StartCover>[0]> = {}) => renderToStaticMarkup(<StartCover
  title="Arrival" backdropUrl="/media/backdrops/7.jpg" source={null} startMs={null} firstFrame={false} {...props}
/>);

describe('StartCover', () => {
  it('shows the dimmed backdrop, the title and a spinner before the source arrives', () => {
    const markup = render();

    expect(markup).toContain('src="/media/backdrops/7.jpg"');
    expect(markup).toContain('view-transition-name:title-backdrop');
    expect(markup).toContain('opacity-50');
    expect(markup).toContain('Arrival');
    expect(markup).toContain('animate-spin');
    expect(markup).not.toContain('/frame?');
  });

  it('loads the frame at the resume position once the source is known', () => {
    const markup = render({ source, startMs: 2_480_000 });

    expect(markup).toContain('src="/api/movies/7/frame?key=abc&amp;t=2480000"');
    // The backdrop stays until the frame has loaded (a 204 or an error keeps it).
    expect(markup).toContain('src="/media/backdrops/7.jpg"');
  });

  it('asks for no frame without a resume position', () => {
    expect(render({ source, startMs: 0 })).not.toContain('/frame?');
    expect(render({ source, startMs: null })).not.toContain('/frame?');
  });

  it('keeps the spinner without a backdrop', () => {
    const markup = render({ backdropUrl: null, title: null });

    expect(markup).not.toContain('<img');
    expect(markup).toContain('animate-spin');
  });

  it('renders nothing once the video shows its first frame', () => {
    expect(render({ source, startMs: 2_480_000, firstFrame: true })).toBe('');
  });
});
