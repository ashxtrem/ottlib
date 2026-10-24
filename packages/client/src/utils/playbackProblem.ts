import type { PlaybackSource } from '@ottlib/shared';

export type PlaybackFailure = 'media' | 'unsupported';

/** What went wrong, as a readable sentence for the watch page; null while playback is fine. */
export function playbackProblem(error: (Error & { status?: number; code?: string }) | null, source: PlaybackSource | null, failure: PlaybackFailure | null): string | null {
  if (error) {
    if (error.status === 503 && error.code === 'TRANSCODE_BUSY') return 'The server is already converting as many videos as it can. Try again when another one stops.';
    if (error.status === 404) return 'This title is no longer in your library.';
    return error.message || 'Playback failed.';
  }
  if (source?.reasons?.includes('ffmpeg-missing')) return 'This file needs ffmpeg on the server to play in the browser.';
  if (failure === 'unsupported') return "This browser can't play this stream.";
  if (failure === 'media') return "This browser couldn't play the video.";
  return null;
}
