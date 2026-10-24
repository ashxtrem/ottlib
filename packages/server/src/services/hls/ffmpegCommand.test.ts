import { describe, expect, it } from 'vitest';
import { amfEncoder } from '../../providers/transcode/amfEncoder.js';
import { nvencEncoder } from '../../providers/transcode/nvencEncoder.js';
import { qsvEncoder } from '../../providers/transcode/qsvEncoder.js';
import { cpuChain, libplaceboChain } from '../../providers/transcode/toneMapFilters.js';
import { x264Encoder } from '../../providers/transcode/x264Encoder.js';
import type { VideoEncoder } from '../../providers/transcode/VideoEncoder.js';
import { buildFfmpegArgs, copySeekMs, type FfmpegCommandInput, type VideoEncode } from './ffmpegCommand.js';

const value = (args: string[], flag: string) => args[args.indexOf(flag) + 1];
const base: FfmpegCommandInput = {
  inputPath: '/films/Arrival.mkv', startSegment: 0, startMs: 0, nextStartMs: 2002,
  video: { kind: 'copy', hevc: false }, audio: { order: 1, copy: false, channels: 6 }, burnSubtitleOrder: null,
};
const encode = (encoder: VideoEncoder, extra: Partial<VideoEncode> = {}): VideoEncode => ({
  kind: 'encode', encoder, targetHeight: 1080, bitrateKbps: 12_000, softwareDecode: false, toneMap: null, ...extra
});

describe('buildFfmpegArgs', () => {
  it('copies the video from the start, keeps timestamps and writes fragmented MP4 to stdout', () => {
    const args = buildFfmpegArgs(base);
    expect(args).not.toContain('-ss');
    expect(args).toEqual(expect.arrayContaining(['-copyts', '-c:v', 'copy', '-map', '0:v:0', '-map', '0:1']));
    expect(value(args, '-i')).toBe('/films/Arrival.mkv');
    expect(value(args, '-output_ts_offset')).toBe('10');
    expect(value(args, '-movflags')).toBe('+frag_keyframe+empty_moov+default_base_moof+frag_discont');
    expect(value(args, '-use_editlist')).toBe('0');
    expect(args.slice(-3)).toEqual(['-f', 'mp4', 'pipe:1']);
    expect(args).not.toContain('-tag:v');
  });

  it('restarts a copy at segment n by seeking just past its keyframe', () => {
    const args = buildFfmpegArgs({ ...base, startSegment: 5, startMs: 10_010, nextStartMs: 11_220 });
    expect(args.slice(args.indexOf('-noaccurate_seek'), args.indexOf('-noaccurate_seek') + 3)).toEqual(['-noaccurate_seek', '-ss', '10.210']);
    expect(args.indexOf('-ss')).toBeLessThan(args.indexOf('-i'));
    expect(copySeekMs(4_004, 4_100)).toBe(4_099);
    expect(copySeekMs(28_028, null)).toBe(28_228);
  });

  it('tags HEVC as hvc1 for Safari', () => {
    expect(value(buildFfmpegArgs({ ...base, video: { kind: 'copy', hevc: true } }), '-tag:v')).toBe('hvc1');
  });

  it('copies audio the client plays, makes AAC otherwise (2 ch 192k, 5.1 at 384k), and drops it when there is none', () => {
    expect(value(buildFfmpegArgs({ ...base, audio: { order: 2, copy: true, channels: 6 } }), '-c:a')).toBe('copy');
    const surround = buildFfmpegArgs(base);
    expect([value(surround, '-c:a'), value(surround, '-ac'), value(surround, '-b:a')]).toEqual(['aac', '6', '384k']);
    const eight = buildFfmpegArgs({ ...base, audio: { order: 1, copy: false, channels: 8 } });
    expect(value(eight, '-ac')).toBe('6');
    const stereo = buildFfmpegArgs({ ...base, audio: { order: 1, copy: false, channels: 2 } });
    expect([value(stereo, '-ac'), value(stereo, '-b:a')]).toEqual(['2', '192k']);
    expect(buildFfmpegArgs({ ...base, audio: null })).toContain('-an');
  });

  it.each([
    ['nvenc', nvencEncoder, 'h264_nvenc', ['-hwaccel', 'cuda']],
    ['qsv', qsvEncoder, 'h264_qsv', ['-hwaccel', 'qsv']],
    ['amf', amfEncoder, 'h264_amf', process.platform === 'win32' ? ['-hwaccel', 'd3d11va'] : []],
    ['x264', x264Encoder, 'libx264', []],
  ])('transcodes with %s: decoder args before -i, encoder after', (_name, encoder, codec, input) => {
    const args = buildFfmpegArgs({ ...base, video: encode(encoder) });
    expect(value(args, '-c:v')).toBe(codec);
    if (input.length) expect(args.indexOf(input[0])).toBeLessThan(args.indexOf('-i'));
    expect(args).not.toContain('-copyts');
    expect(value(args, '-force_key_frames')).toBe('expr:gte(t,n_forced*4)');
  });

  it('restarts a transcode at segment n: accurate seek and the film timeline kept with the output offset', () => {
    const args = buildFfmpegArgs({ ...base, startSegment: 4, startMs: 16_000, nextStartMs: 20_000, video: encode(x264Encoder) });
    expect(value(args, '-ss')).toBe('16.000');
    expect(args).not.toContain('-noaccurate_seek');
    expect(value(args, '-output_ts_offset')).toBe('26.000');
  });

  it('decodes in software when asked (no GPU scaler in the build)', () => {
    const args = buildFfmpegArgs({ ...base, video: encode(nvencEncoder, { softwareDecode: true }) });
    expect(args).not.toContain('-hwaccel');
    expect(value(args, '-vf')).toBe('scale=-2:1080,format=yuv420p');
  });

  it('tone-maps with the chain: its device args first, its filters before the scale, software frames', () => {
    const args = buildFfmpegArgs({ ...base, video: encode(nvencEncoder, { toneMap: libplaceboChain }) });
    expect(args.slice(0, 8)).toContain('-init_hw_device');
    expect(args).not.toContain('-hwaccel');
    expect(value(args, '-vf')).toMatch(/^libplacebo=w=-2:h=1080:.*,scale=-2:1080,format=yuv420p$/);
  });

  it('caps the CPU tone-map chain at 1080p', () => {
    const args = buildFfmpegArgs({ ...base, video: encode(x264Encoder, { targetHeight: 2160, toneMap: cpuChain }) });
    expect(value(args, '-vf')).toContain('scale=-2:1080,format=yuv420p');
    expect(value(args, '-vf')).not.toContain('2160');
  });

  it('burns an image subtitle in with an overlay graph after tone-mapping and before scaling', () => {
    const args = buildFfmpegArgs({ ...base, burnSubtitleOrder: 3, video: encode(nvencEncoder, { toneMap: cpuChain }) });
    expect(args).not.toContain('-vf');
    expect(args).not.toContain('-hwaccel');
    const graph = value(args, '-filter_complex');
    expect(graph).toMatch(/^\[0:v:0\]scale=-2:1080,zscale.*\[base\];\[base\]\[0:3\]overlay=eof_action=pass\[sub\];\[sub\]scale=-2:1080,format=yuv420p\[v\]$/);
    expect(value(args, '-map')).toBe('[v]');
  });

  it('burns in without tone-mapping through a null filter', () => {
    const graph = value(buildFfmpegArgs({ ...base, burnSubtitleOrder: 2, video: encode(x264Encoder) }), '-filter_complex');
    expect(graph.startsWith('[0:v:0]null[base];[base][0:2]overlay')).toBe(true);
  });
});
