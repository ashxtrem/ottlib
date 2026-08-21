import { stat } from 'node:fs/promises';
import { MovieRepository, type PlaybackMovie } from '../repositories/movieRepository.js';
import { isWithinRoot } from './scanner/walker.js';
import { LanPlaylist } from '../providers/playback/lanPlaylist.js';
import { LocalLaunch } from '../providers/playback/localLaunch.js';

export class PlaybackService {
  private readonly local = new LocalLaunch();
  private readonly playlist = new LanPlaylist();
  public constructor(private readonly movies: MovieRepository) {}

  public async movieFile(id: number): Promise<PlaybackMovie> {
    const movie = this.movies.playbackMovie(id);
    if (!movie || movie.missing || !isWithinRoot(movie.folderPath, movie.path)) throw new Error('Movie file is unavailable');
    await stat(movie.path); return movie;
  }
  public async playLocal(id: number): Promise<void> { this.local.open(await this.movieFile(id)); }
  public async reveal(id: number): Promise<void> { this.local.reveal(await this.movieFile(id)); }
  public async playlistFor(id: number, origin: string): Promise<string> { return this.playlist.playlist(origin, await this.movieFile(id)); }
}
