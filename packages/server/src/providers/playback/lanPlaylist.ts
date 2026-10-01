import type { PlaybackMovie } from '../../repositories/movieRepository.js';
import type { PlaylistPlaybackHandoff } from './PlaybackHandoff.js';

export class LanPlaylist implements PlaylistPlaybackHandoff {
  public readonly name = 'lan-playlist';
  public playlist(origin: string, movie: PlaybackMovie, query = ''): string { return `${origin}/api/stream/${movie.id}${query}\n`; }
}
