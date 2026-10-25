import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { MediaInfo } from '@ottlib/shared';
import { formatPictureLine, MediaInfoPanel } from './MediaInfoPanel';
import { ToastContext } from './ToastProvider';

const base: MediaInfo = { container: 'mkv', durationMs: 7_200_000, width: 3840, height: 2160, videoCodec: 'hevc', videoProfile: 'Main 10', videoBitRate: null, hdrFormat: null, tracks: [] };
const render = (mediaInfo: MediaInfo) => renderToStaticMarkup(<ToastContext.Provider value={{ show: () => undefined }}><MediaInfoPanel mediaInfo={mediaInfo} filePath="/movies/a.mkv" /></ToastContext.Provider>);

describe('MediaInfoPanel picture line', () => {
  it('shows the detected picture inside a 16:9 frame', () => {
    const markup = render({ ...base, pictureWidth: 3840, pictureHeight: 1632 });

    expect(markup).toContain('Picture 3840×1632 (2.35:1) in a 16:9 frame');
  });

  it('is hidden when the picture size is null or absent', () => {
    expect(render({ ...base, pictureWidth: null, pictureHeight: null })).not.toContain('Picture ');
    expect(render(base)).not.toContain('Picture ');
  });
});

describe('formatPictureLine', () => {
  it('names a 4:3 frame within 1%', () => {
    expect(formatPictureLine({ width: 1440, height: 1080, pictureWidth: 1440, pictureHeight: 800 })).toBe('Picture 1440×800 (1.80:1) in a 4:3 frame');
  });

  it('falls back to x.xx:1 for other frames', () => {
    expect(formatPictureLine({ width: 1920, height: 800, pictureWidth: 1920, pictureHeight: 700 })).toBe('Picture 1920×700 (2.74:1) in a 2.40:1 frame');
  });

  it('returns null without a picture size', () => {
    expect(formatPictureLine(null)).toBeNull();
    expect(formatPictureLine({ width: 1920, height: 1080, pictureWidth: 1920, pictureHeight: null })).toBeNull();
  });
});
