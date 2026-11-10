import { describe, expect, it } from 'vitest';
import type { TorrentConnectionStatus } from '@ottlib/shared';
import { qbittorrentCheck } from './qbittorrentCheck.js';

const status = (value: TorrentConnectionStatus['status'], message = 'msg'): TorrentConnectionStatus => ({ configured: value !== 'not-configured', status: value, message, plugins: [] });

describe('qbittorrent check', () => {
  it('is ok when it connects (even without search plugins)', async () => {
    expect((await qbittorrentCheck(async () => status('connected', 'Connected.')).run())).toEqual({ state: 'ok', message: 'Connected.' });
    expect((await qbittorrentCheck(async () => status('plugins-missing')).run()).state).toBe('ok');
  });

  it('fails when it cannot connect or sign in', async () => {
    for (const value of ['unreachable', 'login-rejected', 'ip-banned', 'not-configured'] as const) {
      const result = await qbittorrentCheck(async () => status(value, value)).run();
      expect(result).toMatchObject({ state: 'fail', message: value });
      expect(result.fix).toBeTruthy();
    }
  });
});
