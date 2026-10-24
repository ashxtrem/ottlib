import { copySeekLeadMs, timelineOffsetSeconds } from '../../config/transcode.js';
import { transcodeSegmentMs } from '../../config/keyframes.js';
import type { ToneMapChain } from '../../providers/transcode/toneMapFilters.js';
import type { EncodeOptions, VideoEncoder } from '../../providers/transcode/VideoEncoder.js';

export interface VideoCopy { kind: 'copy'; hevc: boolean }

export interface VideoEncode {
  kind: 'encode';
  encoder: VideoEncoder;
  /** Output height before a tone-map chain caps it. */
  targetHeight: number;
  bitrateKbps: number;
  /** Decode on the CPU even without burn-in or tone-mapping (e.g. the build lacks the encoder's GPU scaler). */
  softwareDecode: boolean;
  toneMap: ToneMapChain | null;
}

export interface FfmpegCommandInput {
  inputPath: string;
  /** Segment the session starts at; its planned start, and the next segment's start (null for the last one). */
  startSegment: number;
  startMs: number;
  nextStartMs: number | null;
  video: VideoCopy | VideoEncode;
  /** ffprobe stream index of the audio track, whether to copy it, and its channel count; null for no audio. */
  audio: { order: number; copy: boolean; channels: number | null } | null;
  /** ffprobe stream index of an image subtitle to overlay (encode only). */
  burnSubtitleOrder: number | null;
}

/** Every session writes fragmented MP4 to stdout, one fragment per video keyframe, on the film's timeline (+ the offset). */
const outputArgs = [
  '-avoid_negative_ts', 'disabled', '-max_muxing_queue_size', '4096',
  '-movflags', '+frag_keyframe+empty_moov+default_base_moof+frag_discont', '-use_editlist', '0',
  '-f', 'mp4', 'pipe:1'
];

const seconds = (ms: number) => (ms / 1000).toFixed(3);

export function audioArgs(audio: FfmpegCommandInput['audio']): string[] {
  if (!audio) return ['-an'];
  if (audio.copy) return ['-map', `0:${audio.order}`, '-c:a', 'copy'];
  const surround = (audio.channels ?? 2) > 2;
  return ['-map', `0:${audio.order}`, '-c:a', 'aac', '-ac', surround ? '6' : '2', '-b:a', surround ? '384k' : '192k'];
}

/** Where a copy-mode restart seeks so ffmpeg lands exactly on the segment's keyframe (see `copySeekLeadMs`). */
export function copySeekMs(startMs: number, nextStartMs: number | null): number {
  const room = nextStartMs === null ? copySeekLeadMs : Math.max(0, nextStartMs - startMs - 1);
  return startMs + Math.min(copySeekLeadMs, room);
}

function copyArgs(input: FfmpegCommandInput, video: VideoCopy): string[] {
  const seek = input.startSegment > 0 ? ['-noaccurate_seek', '-ss', seconds(copySeekMs(input.startMs, input.nextStartMs))] : [];
  return [
    ...seek, '-copyts', '-i', input.inputPath, '-map', '0:v:0', '-c:v', 'copy', ...(video.hevc ? ['-tag:v', 'hvc1'] : []),
    ...audioArgs(input.audio), '-output_ts_offset', String(timelineOffsetSeconds)
  ];
}

/** Replaces the encoder's `-vf` chain with a filter graph that overlays the subtitle (after tone-mapping, before scaling). */
function withOverlay(output: string[], toneMapFilters: string[], subtitleOrder: number): string[] {
  const at = output.indexOf('-vf');
  const chain = at >= 0 ? output[at + 1] : 'null';
  const rest = at >= 0 ? [...output.slice(0, at), ...output.slice(at + 2)] : output;
  const graph = `[0:v:0]${toneMapFilters.join(',') || 'null'}[base];[base][0:${subtitleOrder}]overlay=eof_action=pass[sub];[sub]${chain}[v]`;
  return ['-filter_complex', graph, '-map', '[v]', ...rest];
}

function encodeArgs(input: FfmpegCommandInput, video: VideoEncode): string[] {
  const burn = input.burnSubtitleOrder;
  const height = video.toneMap ? video.toneMap.outputHeight(video.targetHeight) : video.targetHeight;
  const toneMapFilters = video.toneMap ? video.toneMap.filters(height) : [];
  const options: EncodeOptions = {
    targetHeight: height, bitrateKbps: video.bitrateKbps, segmentSeconds: transcodeSegmentMs / 1000,
    softwareDecode: video.softwareDecode || burn !== null || video.toneMap !== null,
    filters: burn === null ? toneMapFilters : [],
  };
  const encoder = video.encoder.args(options);
  const videoOut = burn === null ? ['-map', '0:v:0', ...encoder.output] : withOverlay(encoder.output, toneMapFilters, burn);
  const seek = input.startSegment > 0 ? ['-ss', seconds(input.startMs)] : [];
  return [
    ...(video.toneMap?.inputArgs ?? []), ...encoder.input, ...seek, '-i', input.inputPath,
    ...videoOut, ...audioArgs(input.audio), '-output_ts_offset', seconds(input.startMs + timelineOffsetSeconds * 1000)
  ];
}

/** The ffmpeg arguments for a session that starts at `startSegment` (pure). */
export function buildFfmpegArgs(input: FfmpegCommandInput): string[] {
  const body = input.video.kind === 'copy' ? copyArgs(input, input.video) : encodeArgs(input, input.video);
  return ['-hide_banner', '-nostdin', '-v', 'error', ...body, ...outputArgs];
}
