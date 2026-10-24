import { describe, expect, it, vi } from 'vitest';
import { retryAfterMs, waitForSubtitle } from './subtitleReadiness';

const answer = (status: number, retryAfter?: string) => ({ status, ok: status >= 200 && status < 300, headers: new Headers(retryAfter ? { 'retry-after': retryAfter } : {}) });

describe('retryAfterMs', () => {
  it('reads seconds, clamps to 1–30 s and defaults to 2 s', () => {
    expect(retryAfterMs('2')).toBe(2000);
    expect(retryAfterMs('0')).toBe(1000);
    expect(retryAfterMs('120')).toBe(30_000);
    expect(retryAfterMs(null)).toBe(2000);
    expect(retryAfterMs('soon')).toBe(2000);
  });
});

describe('waitForSubtitle', () => {
  it('polls while the server answers 202, waiting Retry-After, until 200', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(answer(202, '3')).mockResolvedValueOnce(answer(202)).mockResolvedValueOnce(answer(200));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const onPreparing = vi.fn();
    await expect(waitForSubtitle('/s.vtt', { signal: new AbortController().signal, onPreparing, fetchImpl, sleep })).resolves.toBe(true);
    expect(onPreparing).toHaveBeenCalledTimes(2);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([3000, 2000]);
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ method: 'HEAD' });
  });

  it('falls back to GET when HEAD is not allowed, and fails on an error answer', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(answer(405)).mockResolvedValueOnce(answer(404));
    await expect(waitForSubtitle('/s.vtt', { signal: new AbortController().signal, onPreparing: vi.fn(), fetchImpl })).resolves.toBe(false);
    expect(fetchImpl.mock.calls[1][1]).toMatchObject({ method: 'GET' });
  });
});
