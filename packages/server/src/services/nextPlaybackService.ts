import type { Movie } from '@ottlib/shared';
import { MovieRepository } from '../repositories/movieRepository.js';
import { ShelfMovieRepository } from '../repositories/shelfMovieRepository.js';
import { PlaybackProgressRepository } from '../repositories/playbackProgressRepository.js';
import { WatchStateRepository } from '../repositories/watchStateRepository.js';

/** Episode order comes from metadata; movie collection order comes from an explicitly selected shelf. */
export class NextPlaybackService {
  public constructor(private readonly movies: MovieRepository, private readonly shelves: ShelfMovieRepository, private readonly progress: PlaybackProgressRepository, private readonly watches: WatchStateRepository) {}

  public collectionId(id: number, deviceId: string, selected?: number): number | undefined {
    const shelf = selected ?? this.progress.get(id, deviceId)?.shelfId ?? this.watches.collectionId(id, deviceId);
    return shelf !== undefined && this.shelves.listMovieIds(shelf).includes(id) ? shelf : undefined;
  }

  public next(id: number, deviceId: string, shelfId?: number): Movie | null {
    const current = this.movies.get(id, deviceId);
    if (!current) return null;
    if (current.mediaType === 'tv') {
      const nextId = this.movies.nextEpisodeId(id);
      return nextId === undefined ? null : this.movies.get(nextId, deviceId) ?? null;
    }
    shelfId = this.collectionId(id, deviceId, shelfId);
    if (shelfId === undefined) return null;
    const ids = this.shelves.listMovieIds(shelfId);
    const index = ids.indexOf(id);
    if (index < 0) return null;
    return this.movies.listByIds(ids.slice(index + 1), deviceId).find(movie => !movie.missing) ?? null;
  }
}
