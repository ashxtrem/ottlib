import { describe, expect, it } from 'vitest';
import { tmdbKeyCheck } from './tmdbKeyCheck.js';

describe('tmdb-key check', () => {
  it('warns without a key and makes no request', async () => {
    let calls = 0;
    const result = await tmdbKeyCheck(() => ' ', async () => { calls++; }).run();
    expect(result.state).toBe('warn');
    expect(calls).toBe(0);
  });

  it('is ok when the key is accepted', async () => {
    let tried = '';
    expect((await tmdbKeyCheck(() => 'abc', async (key) => { tried = key; }).run()).state).toBe('ok');
    expect(tried).toBe('abc');
  });

  it('fails with the reason when the key is rejected', async () => {
    const result = await tmdbKeyCheck(() => 'bad', async () => { throw new Error('TMDb key test failed: 401'); }).run();
    expect(result).toMatchObject({ state: 'fail', message: 'TMDb key test failed: 401' });
  });
});
