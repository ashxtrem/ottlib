import type { PlaybackMovie } from '../../repositories/movieRepository.js';

export interface PlaybackHandoff { name: string }
export interface LocalPlaybackHandoff extends PlaybackHandoff {
  /** True when the file will open in VLC (so a start time is honoured) rather than the OS default player. */
  hasVlc(): boolean;
  open(movie: PlaybackMovie, startSec?: number): void;
  reveal(movie: PlaybackMovie): void;
}
export interface PlaylistPlaybackHandoff extends PlaybackHandoff { playlist(origin: string, movie: PlaybackMovie, query?: string, startSec?: number): string }
