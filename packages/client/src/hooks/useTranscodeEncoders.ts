import { useQuery } from '@tanstack/react-query';
import type { TranscodeEncoders } from '@ottlib/shared';
import { api } from './apiClient';

export const transcodeEncodersQueryKey = ['transcode-encoders'] as const;

/** What the server's ffmpeg can transcode with (GET /api/transcode/encoders). */
export function useTranscodeEncoders() {
  return useQuery({ queryKey: transcodeEncodersQueryKey, queryFn: () => api<TranscodeEncoders>('/api/transcode/encoders') });
}
