import { describe, expect, it } from 'vitest';
import { cpuChain, libplaceboChain, openclChain, pickToneMapChain } from './toneMapFilters.js';

describe('pickToneMapChain', () => {
  it('prefers libplacebo on the GPU', () => {
    expect(pickToneMapChain(new Set(['libplacebo', 'tonemap_opencl', 'hwupload', 'hwdownload', 'zscale', 'tonemap']))).toBe(libplaceboChain);
  });

  it('uses tonemap_opencl without libplacebo', () => {
    expect(pickToneMapChain(new Set(['tonemap_opencl', 'hwupload', 'hwdownload', 'zscale', 'tonemap']))).toBe(openclChain);
  });

  it('falls back to zscale + tonemap on the CPU', () => {
    expect(pickToneMapChain(new Set(['zscale', 'tonemap', 'scale']))).toBe(cpuChain);
  });

  it('returns null when the build cannot tone-map', () => {
    expect(pickToneMapChain(new Set(['scale', 'tonemap']))).toBeNull();
  });
});

describe('tone-map chains', () => {
  it('caps the CPU chain at 1080p', () => {
    expect(cpuChain.outputHeight(2160)).toBe(1080);
    expect(cpuChain.outputHeight(720)).toBe(720);
    expect(cpuChain.filters(2160)[0]).toBe('scale=-2:1080');
    expect(cpuChain.filters(2160).at(-1)).toBe('format=yuv420p');
  });

  it('keeps the target height on the GPU and sets up its device', () => {
    expect(libplaceboChain.outputHeight(2160)).toBe(2160);
    expect(libplaceboChain.filters(2160)[0]).toContain('h=2160');
    expect(libplaceboChain.inputArgs).toEqual(['-init_hw_device', 'vulkan']);
    expect(openclChain.filters(1440)[0]).toBe('scale=-2:1440');
    expect(openclChain.inputArgs).toContain('-filter_hw_device');
  });
});
