import { pictureAreaConfig } from '../../config/pictureArea.js';
import type { FfmpegBinary } from '../../providers/transcode/ffmpegLocator.js';
import { MovieRepository } from '../../repositories/movieRepository.js';
import { CropDetector, type PictureDetector } from './cropDetector.js';
import { unionArea } from './pictureAreaMath.js';

/** The pass that measures the real picture area of each pending file, one file at a time, in the background after a scan. */
export class PictureAreaService {
  private running: Promise<void> | null = null;
  private rerun = false;

  public constructor(
    private readonly movies: MovieRepository,
    private readonly locate: () => Promise<FfmpegBinary | null>,
    private readonly detector: PictureDetector = new CropDetector(),
    private readonly log: (message: string) => void = () => undefined
  ) {}

  /** Single-flight: a call while a pass is running returns that pass, which then runs once more so rows reset or probed meanwhile are seen. Never rejects. */
  public runPending(): Promise<void> {
    if (this.running) {
      this.rerun = true;
      return this.running;
    }
    this.running = this.passes().finally(() => { this.running = null; });
    return this.running;
  }

  private async passes(): Promise<void> {
    do {
      this.rerun = false;
      try {
        await this.process();
      } catch (error) {
        this.log(`Picture area detection failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    } while (this.rerun);
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
        // Applied only while the row still has the size and mtime it was read with, so a file changed mid-detection keeps its reset.
        const version = { size: row.size, mtimeMs: row.mtimeMs };
        try {
          const samples = await this.detector.detect(ffmpeg, row.path, row.durationMs);
          const result = unionArea(samples, row.frameWidth, row.frameHeight);
          this.movies.applyPictureArea(row.id, result.area, result.status, version);
        } catch (error) {
          this.log(`Picture area detection failed for movie ${row.id}: ${error instanceof Error ? error.message : String(error)}`);
          this.movies.applyPictureArea(row.id, null, 'failed', version);
        }
      }
    }
  }
}
