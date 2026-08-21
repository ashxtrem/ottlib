import { MediaTrackRepository } from '../repositories/mediaTrackRepository.js';
import { MovieRepository } from '../repositories/movieRepository.js';
import { MediaProbeService } from './mediaProbeService.js';
import { findExternalSubtitleTracks } from './scanner/externalSubtitleScanner.js';

export class MediaInfoService {
  public constructor(private readonly movies: MovieRepository, private readonly tracks: MediaTrackRepository, private readonly probe: MediaProbeService) {}

  public async refresh(movieId: number, filePath: string): Promise<void> {
    this.movies.clearMediaInfo(movieId);
    this.tracks.clearForMovie(movieId);
    try {
      const probed = await this.probe.probe(filePath);
      const externalSubtitles = await findExternalSubtitleTracks(filePath);
      this.movies.applyMediaInfo(movieId, probed.mediaInfo);
      this.tracks.replaceForMovie(movieId, [...probed.tracks, ...externalSubtitles]);
    } catch (error) {
      this.movies.markMediaProbeFailed(movieId, error instanceof Error ? error.message : 'Media probe failed');
    }
  }
}
