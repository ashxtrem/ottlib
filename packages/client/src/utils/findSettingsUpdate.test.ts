import { describe, expect, it } from 'vitest';
import { findSettingsUpdate } from './findSettingsUpdate';

function form(): FormData {
  const values = new FormData();
  values.set('qbittorrentUrl', ' http://127.0.0.1:8080 '); values.set('qbittorrentUsername', 'admin'); values.set('qbittorrentPassword', 'secret');
  values.set('qbittorrentCategory', 'ottlib'); values.set('qbittorrentSavePath', ''); values.set('torrentPreferredResolution', '1080p');
  return values;
}

describe('findSettingsUpdate', () => {
  it('saves the provider and the qBittorrent fields in qBittorrent mode', () => {
    expect(findSettingsUpdate(form(), true, 'qbittorrent')).toEqual({
      torrentSearchEnabled: true, findProvider: 'qbittorrent', qbittorrentUrl: 'http://127.0.0.1:8080', qbittorrentUsername: 'admin', qbittorrentPassword: 'secret',
      qbittorrentCategory: 'ottlib', qbittorrentSavePath: '', torrentPreferredResolution: '1080p', torrentPreferredCodec: null, torrentMaxSizeGb: null
    });
  });

  it('saves only the switch and the provider in Hashlark mode or while Find is off', () => {
    expect(findSettingsUpdate(form(), true, 'hashlark')).toEqual({ torrentSearchEnabled: true, findProvider: 'hashlark' });
    expect(findSettingsUpdate(form(), false, 'qbittorrent')).toEqual({ torrentSearchEnabled: false, findProvider: 'qbittorrent' });
  });
});
