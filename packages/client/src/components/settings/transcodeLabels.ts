import type { TranscodeEncoder, TranscodeEncoders } from '@ottlib/shared';

/** The encoder choices in the order the select lists them. */
export const transcodeEncoderOptions: ReadonlyArray<{ value: TranscodeEncoder; label: string }> = [
  { value: 'auto', label: 'Auto (best available)' },
  { value: 'nvenc', label: 'NVENC (NVIDIA)' },
  { value: 'qsv', label: 'QSV (Intel Quick Sync)' },
  { value: 'amf', label: 'AMF (AMD)' },
  { value: 'x264', label: 'x264 (CPU)' },
];

const shortLabels: Record<string, string> = { nvenc: 'NVENC', qsv: 'QSV', amf: 'AMF', x264: 'x264' };

/** Short display name for an encoder id the server reports; unknown ids pass through. */
export function encoderLabel(id: string): string {
  return shortLabels[id] ?? id;
}

/** One line summarising the server's ffmpeg: version, detected encoders and the active one. */
export function transcodeStatusLine(status: TranscodeEncoders): string {
  if (!status.available) return 'ffmpeg not found';
  const version = status.ffmpegVersion ? `ffmpeg ${status.ffmpegVersion}` : 'ffmpeg (unknown version)';
  const detected = status.encoders.length ? status.encoders.map(encoderLabel).join(', ') : 'none';
  const active = status.active ? encoderLabel(status.active) : 'none';
  return `${version} · detected: ${detected} · active: ${active}`;
}
