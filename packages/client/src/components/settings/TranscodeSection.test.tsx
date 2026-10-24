import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { TranscodeSection } from './TranscodeSection';

const render = (props: Partial<Parameters<typeof TranscodeSection>[0]>) =>
  renderToStaticMarkup(<TranscodeSection value="auto" onChange={vi.fn()} saving={false} status={undefined} {...props} />);

describe('TranscodeSection', () => {
  it('offers every encoder and selects the saved one', () => {
    const markup = render({ value: 'qsv' });
    for (const label of ['Auto', 'NVENC', 'QSV', 'AMF', 'x264']) expect(markup).toContain(label);
    expect(markup).toMatch(/<option value="qsv" selected="">/);
  });

  it('shows detected encoders, the active one and the ffmpeg version when found', () => {
    const markup = render({ status: { available: true, ffmpegVersion: '7.1', encoders: ['nvenc', 'x264'], active: 'nvenc' } });
    expect(markup).toContain('ffmpeg 7.1');
    expect(markup).toContain('detected: NVENC, x264');
    expect(markup).toContain('active: NVENC');
    expect(markup).not.toContain('ffmpeg not found');
  });

  it('says ffmpeg not found with an install hint', () => {
    const markup = render({ status: { available: false, ffmpegVersion: null, encoders: [], active: null } });
    expect(markup).toContain('ffmpeg not found');
    expect(markup).toContain('PATH');
  });

  it('shows a loading line, then a fetch error', () => {
    expect(render({})).toContain('Checking ffmpeg');
    expect(render({ statusError: 'Network down' })).toContain('Network down');
  });
});
