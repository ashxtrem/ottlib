import { describe, expect, it, vi } from 'vitest';
import { completeThen } from './completeThen';

describe('completeThen', () => {
  it('proceeds after complete succeeds', async () => {
    const proceed = vi.fn(); const onFail = vi.fn();
    await expect(completeThen(() => Promise.resolve(), proceed, onFail)).resolves.toBe(true);
    expect(proceed).toHaveBeenCalledTimes(1);
    expect(onFail).not.toHaveBeenCalled();
  });

  it('stays put and reports the failure when complete rejects', async () => {
    const proceed = vi.fn(); const onFail = vi.fn();
    await expect(completeThen(() => Promise.reject(new Error('503')), proceed, onFail)).resolves.toBe(false);
    expect(proceed).not.toHaveBeenCalled();
    expect(onFail).toHaveBeenCalledTimes(1);
  });
});
