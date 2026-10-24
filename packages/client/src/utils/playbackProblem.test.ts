import { describe, expect, it } from 'vitest';
import type { PlaybackSource } from '@ottlib/shared';
import { ApiError } from '../hooks/apiClient';
import { playbackProblem } from './playbackProblem';

const source = (reasons?: string[]): PlaybackSource => ({ kind: 'direct', streamUrl: '/api/stream/1', mimeType: 'video/x-matroska', durationMs: 1000, resumePositionMs: null, subtitles: [], reasons });

describe('playbackProblem', () => {
  it('explains a missing ffmpeg', () => {
    expect(playbackProblem(null, source(['ffmpeg-missing', 'video-codec']), null)).toBe('This file needs ffmpeg on the server to play in the browser.');
  });
  it('explains a busy server and other request failures', () => {
    expect(playbackProblem(new ApiError('busy', 503, 'TRANSCODE_BUSY'), null, null)).toMatch(/already converting/);
    expect(playbackProblem(new ApiError('Movie not found', 404), null, null)).toBe('This title is no longer in your library.');
    expect(playbackProblem(new ApiError('Boom', 500), null, null)).toBe('Boom');
  });
  it('reports media errors and stays quiet when all is well', () => {
    expect(playbackProblem(null, source(), 'media')).toBe("This browser couldn't play the video.");
    expect(playbackProblem(null, source(['container']), null)).toBeNull();
  });
});
