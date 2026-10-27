import { creditsConfig } from '../../config/credits.js';
import { MovieRepository } from '../../repositories/movieRepository.js';
import { ChapterReader } from './chapterReader.js';

/** The pass that reads each pending file's chapters for a credits chapter, in the background after startup and after a scan. */
export class CreditsService {
  private running: Promise<void> | null = null;
  private rerun = false;

  public constructor(
    private readonly movies: MovieRepository,
    private readonly reader: Pick<ChapterReader, 'read'> = new ChapterReader(),
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
        this.log(`Credits chapter pass failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    } while (this.rerun);
  }

  private async process(): Promise<void> {
    // The cursor moves past every row seen, so rows whose chapters could not be read (left pending) are not fetched again in this pass.
    let cursor = 0;
    for (;;) {
      const batch = this.movies.pendingCredits(creditsConfig.chapterBatchSize, cursor);
      if (batch.length === 0) return;
      for (const row of batch) {
        cursor = row.id;
        try {
          // Applied only while the row still has the size and mtime it was read with, so a file changed mid-read keeps its reset.
          this.movies.applyCreditsChapter(row.id, await this.reader.read(row.path, row.durationMs), { size: row.size, mtimeMs: row.mtimeMs });
        } catch (error) {
          this.log(`Credits chapter read failed for movie ${row.id}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }
}
