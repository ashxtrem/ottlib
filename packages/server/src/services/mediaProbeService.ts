import { spawn } from 'node:child_process';
import type { MediaTrack } from '@ottlib/shared';
import type { ProbedMediaInfo } from '../repositories/movieRepository.js';

interface FfprobeStream {
  index?: number;
  codec_type?: string;
  codec_name?: string;
  profile?: string;
  width?: number;
  height?: number;
  bit_rate?: string;
  channels?: number;
  channel_layout?: string;
  color_transfer?: string;
  tags?: { language?: string; title?: string };
  disposition?: { default?: number; forced?: number; hearing_impaired?: number };
  side_data_list?: Array<{ side_data_type?: string }>;
}

interface FfprobeOutput {
  format?: { format_name?: string; duration?: string };
  streams?: FfprobeStream[];
}

export interface ProbedMedia {
  mediaInfo: ProbedMediaInfo;
  tracks: MediaTrack[];
}

const codecLabels: Record<string, string> = {
  h264: 'H.264', hevc: 'HEVC', av1: 'AV1', vp9: 'VP9', mpeg4: 'MPEG-4', mpeg2video: 'MPEG-2',
  aac: 'AAC', ac3: 'AC-3', eac3: 'E-AC-3', truehd: 'TrueHD', dts: 'DTS', opus: 'Opus', vorbis: 'Vorbis',
  subrip: 'SRT', ass: 'ASS', ssa: 'SSA', webvtt: 'WebVTT', hdmv_pgs_subtitle: 'PGS', dvd_subtitle: 'VobSub'
};

const containerLabels: Record<string, string> = {
  matroska: 'MKV', webm: 'WebM', mov: 'MP4', mp4: 'MP4', avi: 'AVI', asf: 'WMV', flv: 'FLV', mpegts: 'MPEG-TS'
};

function nullableInteger(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function nullableDuration(value: unknown): number | null {
  const seconds = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : Number.NaN;
  const milliseconds = Math.round(seconds * 1_000);
  return Number.isSafeInteger(milliseconds) && milliseconds >= 0 ? milliseconds : null;
}

function codecLabel(value: string | undefined): string | null {
  if (!value) return null;
  return codecLabels[value.toLowerCase()] ?? value.toUpperCase();
}

function containerLabel(value: string | undefined): string | null {
  if (!value) return null;
  const first = value.split(',')[0].trim().toLowerCase();
  return containerLabels[first] ?? first.toUpperCase();
}

function language(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized && normalized.toLowerCase() !== 'und' ? normalized : null;
}

function hdrFormat(stream: FfprobeStream | undefined): string | null {
  if (!stream) return null;
  const sideData = stream.side_data_list?.map((item) => item.side_data_type?.toLowerCase() ?? '').join(' ') ?? '';
  if (sideData.includes('dovi') || sideData.includes('dolby vision')) return 'Dolby Vision';
  if (sideData.includes('hdr10+')) return 'HDR10+';
  if (stream.color_transfer?.toLowerCase() === 'smpte2084') return 'HDR10';
  if (stream.color_transfer?.toLowerCase() === 'arib-std-b67') return 'HLG';
  return null;
}

export function extractProbedMedia(payload: FfprobeOutput): ProbedMedia {
  const streams = Array.isArray(payload.streams) ? payload.streams : [];
  const video = streams.find((stream) => stream.codec_type === 'video');
  const tracks = streams.flatMap((stream, order): MediaTrack[] => {
    if (stream.codec_type !== 'audio' && stream.codec_type !== 'subtitle') return [];
    return [{
      type: stream.codec_type,
      source: 'embedded',
      order: nullableInteger(stream.index) ?? order,
      language: language(stream.tags?.language),
      title: stream.tags?.title?.trim() || null,
      codec: codecLabel(stream.codec_name),
      channels: stream.codec_type === 'audio' ? nullableInteger(stream.channels) : null,
      channelLayout: stream.codec_type === 'audio' ? stream.channel_layout?.trim() || null : null,
      isDefault: Boolean(stream.disposition?.default),
      isForced: Boolean(stream.disposition?.forced),
      isHearingImpaired: Boolean(stream.disposition?.hearing_impaired)
    }];
  });
  return {
    mediaInfo: {
      container: containerLabel(payload.format?.format_name),
      durationMs: nullableDuration(payload.format?.duration),
      width: nullableInteger(video?.width),
      height: nullableInteger(video?.height),
      videoCodec: codecLabel(video?.codec_name),
      videoProfile: video?.profile?.trim() || null,
      videoBitRate: nullableInteger(video?.bit_rate),
      hdrFormat: hdrFormat(video)
    },
    tracks
  };
}

export class MediaProbeService {
  public constructor(private readonly command = process.env.FFPROBE_PATH || 'ffprobe') {}

  public async probe(filePath: string): Promise<ProbedMedia> {
    const output = await this.run(filePath);
    let payload: FfprobeOutput;
    try { payload = JSON.parse(output) as FfprobeOutput; } catch { throw new Error('ffprobe returned invalid JSON'); }
    return extractProbedMedia(payload);
  }

  private run(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.command, ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', filePath], { windowsHide: true });
      let stdout = ''; let stderr = ''; let settled = false;
      const finish = (callback: () => void) => { if (!settled) { settled = true; clearTimeout(timeout); callback(); } };
      const timeout = setTimeout(() => { child.kill(); finish(() => reject(new Error('ffprobe timed out after 20 seconds'))); }, 20_000);
      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
        if (stdout.length > 4_000_000) { child.kill(); finish(() => reject(new Error('ffprobe output exceeded 4 MB'))); }
      });
      child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
      child.once('error', (error) => finish(() => reject((error as NodeJS.ErrnoException).code === 'ENOENT' ? new Error('ffprobe is not installed or not on PATH') : error)));
      child.once('close', (code) => finish(() => code === 0 ? resolve(stdout) : reject(new Error(stderr.trim() || `ffprobe exited with code ${code ?? 'unknown'}`))));
    });
  }
}
