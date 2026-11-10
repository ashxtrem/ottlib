import { renderToStaticMarkup } from 'react-dom/server';
import type { Settings } from '@ottlib/shared';
import { describe, expect, it } from 'vitest';
import { torrentPreferencesUpdate } from '../utils/torrentPreferences';
import { QbittorrentSettingsSection } from './QbittorrentSettingsSection';

const render = (settings: Partial<Settings>, enabled = true) => renderToStaticMarkup(<QbittorrentSettingsSection settings={{ qbittorrentUrl: '', qbittorrentUsername: '', qbittorrentPassword: '', qbittorrentCategory: 'ottlib', qbittorrentSavePath: '', torrentPreferredResolution: null, torrentPreferredCodec: null, torrentMaxSizeGb: null, ...settings } as Settings} enabled={enabled} onEnabledChange={() => undefined} testing={false} onTest={() => undefined} />);

describe('QbittorrentSettingsSection release preferences', () => {
  it('shows the saved resolution, codec and size cap', () => {
    const markup = render({ torrentPreferredResolution: '1080p', torrentPreferredCodec: 'hevc', torrentMaxSizeGb: 12.5 });
    expect(markup).toMatch(/<option value="1080p" selected="">/);
    expect(markup).toMatch(/<option value="hevc" selected="">/);
    expect(markup).toMatch(/name="torrentMaxSizeGb"[^>]*value="12.5"/);
  });

  it('defaults to no preference and hides the fields while torrent search is off', () => {
    expect(render({})).toMatch(/<option value="" selected="">No preference/);
    expect(render({}, false)).not.toContain('torrentPreferredResolution');
  });
});

describe('torrentPreferencesUpdate', () => {
  it('reads the three fields from the form', () => {
    const values = new FormData();
    values.set('torrentPreferredResolution', '2160p'); values.set('torrentPreferredCodec', 'av1'); values.set('torrentMaxSizeGb', '8');
    expect(torrentPreferencesUpdate(values)).toEqual({ torrentPreferredResolution: '2160p', torrentPreferredCodec: 'av1', torrentMaxSizeGb: 8 });
  });

  it('turns empty or invalid values into null so a preference can be cleared', () => {
    const values = new FormData();
    values.set('torrentPreferredResolution', ''); values.set('torrentPreferredCodec', 'divx'); values.set('torrentMaxSizeGb', '-3');
    expect(torrentPreferencesUpdate(values)).toEqual({ torrentPreferredResolution: null, torrentPreferredCodec: null, torrentMaxSizeGb: null });
    expect(torrentPreferencesUpdate(new FormData()).torrentMaxSizeGb).toBeNull();
  });
});
