import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { DISK_FAIL_BYTES, DISK_WARN_BYTES, diskSpaceCheck } from './diskSpaceCheck.js';

describe('disk-space check', () => {
  it('is ok with room, warn under 1 GB, fail under 256 MB', async () => {
    const at = (bytes: number) => diskSpaceCheck('/data', async () => bytes).run();
    expect((await at(5 * DISK_WARN_BYTES)).state).toBe('ok');
    expect((await at(DISK_WARN_BYTES - 1)).state).toBe('warn');
    expect((await at(DISK_FAIL_BYTES - 1)).state).toBe('fail');
    expect((await at(DISK_FAIL_BYTES - 1)).fix).toBeTruthy();
  });

  it('asks the data path, and by default reads it with statfs', async () => {
    let asked = '';
    await diskSpaceCheck('/my/data', async (path) => { asked = path; return DISK_WARN_BYTES * 2; }).run();
    expect(asked).toBe('/my/data');
    expect((await diskSpaceCheck(tmpdir()).run()).message).toMatch(/free on the data drive/);
  });
});
