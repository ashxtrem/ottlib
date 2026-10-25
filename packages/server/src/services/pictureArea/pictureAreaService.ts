import { pictureAreaConfig } from '../../config/pictureArea.js';
import type { FfmpegBinary } from '../../providers/transcode/ffmpegLocator.js';
import { MovieRepository } from '../../repositories/movieRepository.js';
import { CropDetector, type PictureDetector } from './cropDetector.js';
import { unionArea } from './pictureAreaMath.js';

/** The pass that measures the real picture area of each pending file, one file at a time, in the background after a scan. */
export class PictureAreaService {
  private running: Promise<void> | null = null;

  public constructor(
    private readonly movies: MovieRepository,
    private readonly locate: () => Promise<FfmpegBinary | null>,
    private readonly detector: PictureDetector = new CropDetector(),
    private readonly log: (message: string) => void = () => undefined
  ) {}

  /** Single-flight: a call while a pass is running returns that pass. Never rejects. */
  public runPending(): Promise<void> {
    this.running ??= this.process().catch((error) => this.log(`Picture area detection failed: ${error instanceof Error ? error.message : String(error)}`)).finally(() => { this.running = null; });
    return this.running;
  }

  private async process(): Promise<void> {
    const ffmpeg = await this.locate();
    if (!ffmpeg) return;
    // The cursor moves past every row seen, so rows skipped (unprobed) and left pending cannot be fetched again in this pass.
    let cursor = 0;
    for (;;) {
      const batch = this.movies.listPicturePending(pictureAreaConfig.batchSize, cursor);
      if (batch.length === 0) return;
      for (const row of batch) {
        cursor = row.id;
        if (!row.durationMs || row.durationMs <= 0 || !row.frameWidth || !row.frameHeight) continue;
        try {
          const samples = await this.detector.detect(ffmpeg, row.path, row.durationMs);
          const result = unionArea(samples, row.frameWidth, row.frameHeight);
          this.movies.applyPictureArea(row.id, result.area, result.status);
        } catch (error) {
          this.log(`Picture area detection failed for movie ${row.id}: ${error instanceof Error ? error.message : String(error)}`);
          this.movies.applyPictureArea(row.id, null, 'failed');
        }
      }
    }
  }
}
