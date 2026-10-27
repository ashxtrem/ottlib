import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PREVIEW_FRAME_WIDTH, PREVIEW_TIME_WIDTH } from '../../utils/scrubTiming';
import { ScrubPreview } from './ScrubPreview';
import { SeekBar } from './SeekBar';

describe('SeekBar', () => {
  it('hides the preview while not dragging', () => {
    const markup = renderToStaticMarkup(<SeekBar positionMs={10_000} durationMs={600_000} bufferedMs={20_000} onSeek={() => undefined} onScrub={() => undefined} previewFrame frameSrc="blob:x" />);
    expect(markup).toContain('aria-label="Seek"');
    expect(markup).not.toContain('scrub-preview');
    expect(markup).not.toContain('<img');
  });

  it('is disabled while the duration is unknown', () => {
    const markup = renderToStaticMarkup(<SeekBar positionMs={0} durationMs={Number.NaN} bufferedMs={0} onSeek={() => undefined} />);
    expect(markup).toContain('disabled');
  });
});

describe('ScrubPreview', () => {
  it('shows a 160 px frame and the time for server HLS', () => {
    const markup = renderToStaticMarkup(<ScrubPreview timeMs={4_520_000} withFrame frameSrc="blob:x" leftPx={20} />);
    expect(markup).toContain(`width:${PREVIEW_FRAME_WIDTH}px`);
    expect(markup).toContain('left:20px');
    expect(markup).toContain('src="blob:x"');
    expect(markup).toContain('1:15:20');
  });

  it('keeps an empty frame box until the first frame lands', () => {
    const markup = renderToStaticMarkup(<ScrubPreview timeMs={0} withFrame frameSrc={null} leftPx={0} />);
    expect(markup).toContain('aspect-video');
    expect(markup).not.toContain('<img');
  });

  it('shows the time alone for direct play', () => {
    const markup = renderToStaticMarkup(<ScrubPreview timeMs={65_000} withFrame={false} frameSrc={null} leftPx={4} />);
    expect(markup).toContain(`width:${PREVIEW_TIME_WIDTH}px`);
    expect(markup).toContain('1:05');
    expect(markup).not.toContain('<img');
    expect(markup).not.toContain('aspect-video');
  });
});
