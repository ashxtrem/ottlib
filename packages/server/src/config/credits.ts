/** End-credits detection and auto-skip. */
export const creditsConfig = {
  /** Auto-skip when a profile has no default of its own: series skip their credits, movies keep theirs (post-credit scenes). */
  defaultAutoSkip: { movie: false, tv: true },
  /** Series learning: a sibling episode's credits length is used only when its duration is within this of the title's. */
  seriesDurationToleranceMs: 120_000,
};
