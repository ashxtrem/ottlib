import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { SubtitleSource } from '@ottlib/shared';
import { TrackMenu } from './TrackMenu';
import { audioItems, subtitleItems } from '../../utils/trackMenuItems';

const text = (url: string, language: string, extra: Partial<SubtitleSource> = {}): SubtitleSource =>
  ({ url, language, codec: 'WEBVTT', title: null, isForced: false, isHearingImpaired: false, ...extra });

describe('subtitleItems', () => {
  it('lists Off, text tracks ("Preparing…" while extracting) and burned-in image tracks', () => {
    const items = subtitleItems({
      text: [text('/a.vtt', 'en'), text('/b.vtt', 'fr', { isHearingImpaired: true })],
      burnIn: [{ order: 4, language: 'de', title: null, codec: 'hdmv_pgs_subtitle', isForced: false }],
      status: { '/a.vtt': 'preparing' },
      current: { kind: 'burn', order: 4 }
    });
    expect(items.map(({ label, detail, selected }) => ({ label, detail, selected }))).toEqual([
      { label: 'Off', detail: undefined, selected: false },
      { label: 'English', detail: 'Preparing…', selected: false },
      { label: 'French', detail: 'SDH', selected: false },
      { label: 'German', detail: 'burned in', selected: true }
    ]);
  });

  it('selects Off when nothing is shown and disables a track that failed to load', () => {
    const items = subtitleItems({ text: [text('/a.vtt', 'en')], burnIn: [], status: { '/a.vtt': 'failed' }, current: { kind: 'off' } });
    expect(items[0].selected).toBe(true);
    expect(items[1]).toMatchObject({ disabled: true, detail: 'Unavailable' });
  });
});

describe('audioItems', () => {
  it('marks the current audio order, or the default track when none was asked for', () => {
    const tracks = [
      { order: 0, language: 'en', title: null, codec: 'eac3', channels: 6, isDefault: false },
      { order: 1, language: 'ja', title: 'Commentary', codec: 'aac', channels: 2, isDefault: true }
    ];
    expect(audioItems(tracks, undefined).map((item) => item.selected)).toEqual([false, true]);
    expect(audioItems(tracks, 0)).toMatchObject([{ label: 'English', detail: 'EAC3 · 5.1', selected: true }, { label: 'Commentary', detail: 'Japanese · AAC · Stereo' }]);
  });
});

describe('TrackMenu', () => {
  it('renders an open menu of radio items with their details', () => {
    const items = subtitleItems({
      text: [text('/a.vtt', 'en')],
      burnIn: [{ order: 3, language: 'en', title: 'Signs', codec: 'pgs', isForced: true }],
      status: { '/a.vtt': 'preparing' },
      current: { kind: 'off' }
    });
    const markup = renderToStaticMarkup(<TrackMenu label="Subtitles" icon="CC" items={items} open onOpenChange={() => undefined} onSelect={() => undefined} buttonClassName="" />);
    expect(markup).toContain('role="menu"');
    expect(markup.match(/role="menuitemradio"/g)).toHaveLength(3);
    expect(markup).toContain('aria-checked="true"');
    expect(markup).toContain('Preparing…');
    expect(markup).toContain('Forced · burned in');
  });

  it('renders only the button while closed', () => {
    const markup = renderToStaticMarkup(<TrackMenu label="Audio" icon="A" items={[]} open={false} onOpenChange={() => undefined} onSelect={() => undefined} buttonClassName="" />);
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain('role="menu"');
  });
});
