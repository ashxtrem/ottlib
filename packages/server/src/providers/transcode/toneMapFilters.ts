import { cpuToneMapMaxHeight } from '../../config/transcode.js';

/**
 * HDR (PQ/HLG) to SDR BT.709 tone-mapping. Every chain takes decoded software frames and returns 8-bit yuv420p
 * software frames at the output height, so it slots into `EncodeOptions.filters` (with `softwareDecode: true`).
 */
export interface ToneMapChain {
  name: 'libplacebo' | 'opencl' | 'cpu';
  /** Global args placed before `-i` (hardware device setup for the filter). */
  inputArgs: string[];
  /** Height the chain actually outputs: the CPU chain caps it so it stays real-time. Use it as `targetHeight`. */
  outputHeight(targetHeight: number): number;
  filters(targetHeight: number): string[];
}

/** GPU via Vulkan; libplacebo uploads and downloads software frames itself. */
export const libplaceboChain: ToneMapChain = {
  name: 'libplacebo',
  inputArgs: ['-init_hw_device', 'vulkan'],
  outputHeight: (height) => height,
  filters: (height) => [
    `libplacebo=w=-2:h=${height}:tonemapping=bt.2390:colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv:format=yuv420p`
  ],
};

/** GPU via OpenCL: scale on the CPU, upload, tone-map, download. */
export const openclChain: ToneMapChain = {
  name: 'opencl',
  // Platform 0, device 0: a bare `opencl=ocl` fails outright when the machine has more than one OpenCL device.
  inputArgs: ['-init_hw_device', 'opencl=ocl:0.0', '-filter_hw_device', 'ocl'],
  outputHeight: (height) => height,
  filters: (height) => [
    `scale=-2:${height}`, 'format=p010le', 'hwupload',
    'tonemap_opencl=tonemap=hable:desat=0:t=bt709:m=bt709:p=bt709:r=tv:format=nv12',
    'hwdownload', 'format=nv12', 'format=yuv420p'
  ],
};

/** CPU: zscale to linear light, Hable tone-map, back to BT.709. Scaled to at most 1080p first. */
export const cpuChain: ToneMapChain = {
  name: 'cpu',
  inputArgs: [],
  outputHeight: (height) => Math.min(height, cpuToneMapMaxHeight),
  filters: (height) => [
    `scale=-2:${Math.min(height, cpuToneMapMaxHeight)}`,
    'zscale=t=linear:npl=100', 'format=gbrpf32le', 'zscale=p=bt709',
    'tonemap=tonemap=hable:desat=0', 'zscale=t=bt709:m=bt709:r=tv', 'format=yuv420p'
  ],
};

/** Best first; each lists the ffmpeg filters it needs. */
const chainsByPreference: readonly { chain: ToneMapChain; requires: string[] }[] = [
  { chain: libplaceboChain, requires: ['libplacebo'] },
  { chain: openclChain, requires: ['tonemap_opencl', 'hwupload', 'hwdownload'] },
  { chain: cpuChain, requires: ['zscale', 'tonemap'] },
];

/** The best chain the ffmpeg build supports (from `FfmpegBinary.filters`), or null when it can't tone-map at all. */
export function pickToneMapChain(filters: ReadonlySet<string>): ToneMapChain | null {
  return chainsByPreference.find(({ requires }) => requires.every((name) => filters.has(name)))?.chain ?? null;
}
