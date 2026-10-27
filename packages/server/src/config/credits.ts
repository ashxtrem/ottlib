/** End-credits detection and auto-skip. */
export const creditsConfig = {
  /** Auto-skip when a profile has no default of its own: series skip their credits, movies keep theirs (post-credit scenes). */
  defaultAutoSkip: { movie: false, tv: true },
  /** Series learning: a sibling episode's credits length is used only when its duration is within this of the title's. */
  seriesDurationToleranceMs: 120_000,
  /** A chapter title that names the end credits. Generic "Chapter 12" titles never match. */
  chapterTitlePattern: /\b(end\s*)?credits?\b|\boutro\b|\bending\b/i,
  /** The credit chapter must start in the last part of the file (0.4 = the last 40%). */
  chapterLastFraction: 0.4,
  /** ...and either end within this of the file's end, or be followed only by more credit-like chapters. */
  chapterEndToleranceMs: 30_000,
  /** Files read per query by the chapter pass. */
  chapterBatchSize: 50,
  /** ffprobe is given this long to list one file's chapters. */
  chapterProbeTimeoutMs: 20_000
};
