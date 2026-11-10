import { describe, expect, it, vi } from 'vitest';
import { startTitleExtrasBackfill } from './titleExtrasBackfill.js';

describe('title extras backfill', () => {
  it('starts one refresh for the titles without extras', () => {
    const startSelectedRefresh = vi.fn(() => ({ id: 1 }));
    expect(startTitleExtrasBackfill({ hasMetadataProvider: () => true, idsMissingExtras: () => [4, 7], startSelectedRefresh })).toBe(true);
    expect(startSelectedRefresh).toHaveBeenCalledOnce();
    expect(startSelectedRefresh).toHaveBeenCalledWith([4, 7]);
  });

  it('does nothing when every title has its extras', () => {
    const startSelectedRefresh = vi.fn(() => ({ id: 1 }));
    expect(startTitleExtrasBackfill({ hasMetadataProvider: () => true, idsMissingExtras: () => [], startSelectedRefresh })).toBe(false);
    expect(startSelectedRefresh).not.toHaveBeenCalled();
  });

  it('leaves an active metadata run alone', () => {
    const log = vi.fn();
    expect(startTitleExtrasBackfill({ hasMetadataProvider: () => true, idsMissingExtras: () => [1], startSelectedRefresh: () => null, log })).toBe(false);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('already active'));
  });

  it('skips when no metadata provider is configured', () => {
    const startSelectedRefresh = vi.fn(() => ({ id: 1 }));
    const idsMissingExtras = vi.fn(() => [1]);
    const log = vi.fn();
    expect(startTitleExtrasBackfill({ hasMetadataProvider: () => false, idsMissingExtras, startSelectedRefresh, log })).toBe(false);
    expect(startSelectedRefresh).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('no metadata provider'));
  });

  it('never throws into server start', () => {
    const log = vi.fn();
    expect(startTitleExtrasBackfill({ hasMetadataProvider: () => true, idsMissingExtras: () => [1], startSelectedRefresh: () => { throw new Error('runs unavailable'); }, log })).toBe(false);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('runs unavailable'));
  });
});
