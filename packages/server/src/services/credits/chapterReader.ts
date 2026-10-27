import { spawn } from 'node:child_process';
import { creditsConfig } from '../../config/credits.js';

export interface ChapterSpan { title: string; startMs: number; endMs: number }

interface FfprobeChapters { chapters?: Array<{ start_time?: string; end_time?: string; tags?: { title?: string } }> }

export function parseChapters(output: string): ChapterSpan[] {
  const payload = JSON.parse(output) as FfprobeChapters;
  const spans: ChapterSpan[] = [];
  for (const chapter of payload.chapters ?? []) {
    const start = Number(chapter.start_time);
    const end = Number(chapter.end_time);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    spans.push({ title: chapter.tags?.title ?? '', startMs: Math.round(start * 1000), endMs: Math.round(end * 1000) });
  }
  return spans.sort((a, b) => a.startMs - b.startMs);
}

/**
 * The start (ms) of the chapter that holds the end credits, or null. The first chapter named like credits that starts in the
 * last part of the file and either ends near the file's end or is followed only by more credit-like chapters.
 */
export function pickCreditsStartMs(chapters: ChapterSpan[], durationMs: number): number | null {
  if (durationMs <= 0) return null;
  const { chapterTitlePattern, chapterLastFraction, chapterEndToleranceMs } = creditsConfig;
  const likeCredits = chapters.map((chapter) => chapterTitlePattern.test(chapter.title));
  for (let index = 0; index < chapters.length; index += 1) {
    const chapter = chapters[index];
    if (!likeCredits[index] || chapter.startMs < durationMs * (1 - chapterLastFraction)) continue;
    const reachesEnd = chapter.endMs >= durationMs - chapterEndToleranceMs;
    if (reachesEnd || likeCredits.slice(index + 1).every(Boolean)) return chapter.startMs;
  }
  return null;
}

/** Lists a file's chapters with ffprobe, spawned like MediaProbeService does (FFPROBE_PATH). */
export class ChapterReader {
  public constructor(private readonly command = process.env.FFPROBE_PATH || 'ffprobe') {}

  /** Rejects when ffprobe cannot run or its output is unusable; resolves null when the file has no credit chapter. */
  public async read(filePath: string, durationMs: number): Promise<number | null> {
    return pickCreditsStartMs(parseChapters(await this.run(filePath)), durationMs);
  }

  private run(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.command, ['-v', 'error', '-show_chapters', '-of', 'json', filePath], { windowsHide: true });
      let stdout = ''; let stderr = ''; let settled = false;
      const finish = (callback: () => void) => { if (!settled) { settled = true; clearTimeout(timeout); callback(); } };
      const timeout = setTimeout(() => { child.kill(); finish(() => reject(new Error('ffprobe timed out reading chapters'))); }, creditsConfig.chapterProbeTimeoutMs);
      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
        if (stdout.length > 4_000_000) { child.kill(); finish(() => reject(new Error('ffprobe chapter output exceeded 4 MB'))); }
      });
      child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
      child.once('error', (error) => finish(() => reject((error as NodeJS.ErrnoException).code === 'ENOENT' ? new Error('ffprobe is not installed or not on PATH') : error)));
      child.once('close', (code) => finish(() => code === 0 ? resolve(stdout) : reject(new Error(stderr.trim() || `ffprobe exited with code ${code ?? 'unknown'}`))));
    });
  }
}
