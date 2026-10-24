import type { PlaybackMovie } from '../../repositories/movieRepository.js';
import type { PlaylistPlaybackHandoff } from './PlaybackHandoff.js';

export class LanPlaylist implements PlaylistPlaybackHandoff {
  public readonly name = 'lan-playlist';
  public playlist(origin: string, movie: PlaybackMovie, query = '', startSec = 0): string {
    const start = startSec > 0 ? `#EXTVLCOPT:start-time=${startSec}\n` : '';
    return `#EXTM3U\n${start}${origin}/api/stream/${movie.id}${query}\n`;
  }
}
