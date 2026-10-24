import { describe, expect, it, vi } from 'vitest';
import { SESSION_KEEPALIVE_MS, startSessionKeepAlive } from './sessionKeepAlive';

function fakeTimer() {
  let tick: (() => void) | undefined;
  let ms = 0;
  let cleared = false;
  return {
    setInterval: (callback: () => void, interval: number) => { tick = callback; ms = interval; cleared = false; return 'handle'; },
    clearInterval: (handle: unknown) => { expect(handle).toBe('handle'); cleared = true; tick = undefined; },
    fire: () => tick?.(),
    get ms() { return ms; },
    get cleared() { return cleared; },
  };
}

describe('startSessionKeepAlive', () => {
  it('posts <sessionUrl>/keepalive on every 15 s tick', () => {
    const timer = fakeTimer();
    const post = vi.fn().mockResolvedValue(undefined);
    startSessionKeepAlive('/api/hls/3/abc', { post, ...timer });
    expect(timer.ms).toBe(SESSION_KEEPALIVE_MS);
    expect(SESSION_KEEPALIVE_MS).toBe(15_000);
    expect(post).not.toHaveBeenCalled();
    timer.fire();
    timer.fire();
    expect(post).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenCalledWith('/api/hls/3/abc/keepalive');
  });

  it('stop() ends the posts', () => {
    const timer = fakeTimer();
    const post = vi.fn().mockResolvedValue(undefined);
    const stop = startSessionKeepAlive('/api/hls/3/abc', { post, ...timer });
    timer.fire();
    stop();
    timer.fire();
    stop();
    expect(timer.cleared).toBe(true);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('does not throw or leave an unhandled rejection when a post fails', async () => {
    const timer = fakeTimer();
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    const post = vi.fn().mockRejectedValueOnce(new Error('offline')).mockImplementationOnce(() => { throw new Error('sync'); });
    startSessionKeepAlive('/api/hls/3/abc', { post, ...timer });
    expect(() => { timer.fire(); timer.fire(); }).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 10));
    process.off('unhandledRejection', unhandled);
    expect(post).toHaveBeenCalledTimes(2);
    expect(unhandled).not.toHaveBeenCalled();
  });

  it('uses the real timer by default', () => {
    vi.useFakeTimers();
    try {
      const post = vi.fn().mockResolvedValue(undefined);
      const stop = startSessionKeepAlive('/s', { post });
      vi.advanceTimersByTime(SESSION_KEEPALIVE_MS * 2);
      stop();
      vi.advanceTimersByTime(SESSION_KEEPALIVE_MS * 2);
      expect(post).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
