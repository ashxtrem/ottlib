import { describe, expect, it } from 'vitest';
import { compareVersions, LATEST_RELEASE_URL, LatestRelease } from '../latestRelease.js';
import { updateCheck } from './updateCheck.js';

function fakeFetch(tag = 'v0.5.0') {
  const calls: string[] = [];
  const fetchFn = async (url: string) => { calls.push(url); return new Response(JSON.stringify({ tag_name: tag }), { status: 200 }); };
  return { calls, fetchFn };
}

describe('update check', () => {
  it('makes no request when VERSION is absent', async () => {
    const { calls, fetchFn } = fakeFetch(); const latest = new LatestRelease(fetchFn);
    const result = await updateCheck({ version: () => null, enabled: () => true, latestTag: () => latest.tag() }).run();
    expect(result).toEqual({ state: 'ok', message: 'Running from source.' });
    expect(calls).toEqual([]);
  });

  it('makes no request when the setting is off', async () => {
    const { calls, fetchFn } = fakeFetch(); const latest = new LatestRelease(fetchFn);
    expect((await updateCheck({ version: () => '0.4.0', enabled: () => false, latestTag: () => latest.tag() }).run()).state).toBe('ok');
    expect(calls).toEqual([]);
  });

  it('warns when a newer release is out, ok when this is the newest', async () => {
    const { calls, fetchFn } = fakeFetch('v0.5.0'); const latest = new LatestRelease(fetchFn);
    const older = await updateCheck({ version: () => '0.4.9', enabled: () => true, latestTag: () => latest.tag() }).run();
    expect(older).toMatchObject({ state: 'warn', message: 'OttLib 0.5.0 is out (this is 0.4.9).' });
    expect((await updateCheck({ version: () => '0.5.0', enabled: () => true, latestTag: () => latest.tag() }).run()).state).toBe('ok');
    expect(calls).toEqual([LATEST_RELEASE_URL]);
  });

  it('warns (never fails) when GitHub cannot be reached', async () => {
    const result = await updateCheck({ version: () => '0.4.0', enabled: () => true, latestTag: async () => { throw new Error('offline'); } }).run();
    expect(result.state).toBe('warn');
  });
});

describe('LatestRelease', () => {
  it('asks GitHub at most once per 24 h', async () => {
    let now = 0; const { calls, fetchFn } = fakeFetch('v1.2.3');
    const latest = new LatestRelease(fetchFn, () => now);
    expect(await latest.tag()).toBe('v1.2.3');
    now += 23 * 60 * 60 * 1000; await latest.tag();
    expect(calls).toHaveLength(1);
    now += 2 * 60 * 60 * 1000; await latest.tag();
    expect(calls).toHaveLength(2);
  });

  it('does not cache a failed answer', async () => {
    let calls = 0;
    const latest = new LatestRelease(async () => { calls++; return new Response('nope', { status: 503 }); });
    await expect(latest.tag()).rejects.toThrow('503');
    await expect(latest.tag()).rejects.toThrow('503');
    expect(calls).toBe(2);
  });
});

describe('compareVersions', () => {
  it('compares numerically and ignores a v prefix', () => {
    expect(compareVersions('0.10.0', '0.9.9')).toBeGreaterThan(0);
    expect(compareVersions('v1.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.2.3', '1.3.0')).toBeLessThan(0);
  });
});
