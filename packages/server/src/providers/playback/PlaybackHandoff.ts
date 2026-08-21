import type { PlaybackMovie } from '../../repositories/movieRepository.js';

export interface PlaybackHandoff { name: string }
export interface LocalPlaybackHandoff extends PlaybackHandoff { open(movie: PlaybackMovie): void; reveal(movie: PlaybackMovie): void }
export interface PlaylistPlaybackHandoff extends PlaybackHandoff { playlist(origin: string, movie: PlaybackMovie): string }
