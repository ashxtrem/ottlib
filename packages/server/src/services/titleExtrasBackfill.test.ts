import { describe, expect, it, vi } from 'vitest';
import { startTitleExtrasBackfill } from './titleExtrasBackfill.js';

describe('title extras backfill', () => {
  it('starts one refresh for the titles without extras', () => {
    const startSelectedRefresh = vi.fn(() => ({ id: 1 }));
    expect(startTitleExtrasBackfill({ idsMissingExtras: () => [4, 7], startSelectedRefresh })).toBe(true);
    expect(startSelectedRefresh).toHaveBeenCalledOnce();
    expect(startSelectedRefresh).toHaveBeenCalledWith([4, 7]);
  });

  it('does nothing when every title has its extras', () => {
    const startSelectedRefresh = vi.fn(() => ({ id: 1 }));
    expect(startTitleExtrasBackfill({ idsMissingExtras: () => [], startSelectedRefresh })).toBe(false);
    expect(startSelectedRefresh).not.toHaveBeenCalled();
  });

  it('leaves an active metadata run alone', () => {
    const log = vi.fn();
    expect(startTitleExtrasBackfill({ idsMissingExtras: () => [1], startSelectedRefresh: () => null, log })).toBe(false);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('already active'));
  });

  it('never throws into server start', () => {
    const log = vi.fn();
    expect(startTitleExtrasBackfill({ idsMissingExtras: () => [1], startSelectedRefresh: () => { throw new Error('runs unavailable'); }, log })).toBe(false);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('runs unavailable'));
  });
});
