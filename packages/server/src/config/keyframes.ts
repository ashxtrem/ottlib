/** Keyframe index and HLS segment planning limits. */
export const keyframeLimits = {
  /** A keyframe index whose average gap is longer than this is unusable for remux segments (caller transcodes). */
  maxAverageGapMs: 10_000,
  /** Keyframe lists remembered in memory, keyed by path + mtime. */
  cacheEntries: 50,
  /** Largest Matroska element (Cues, Tracks, Info, SeekHead) read into memory. */
  maxElementBytes: 64 * 1024 * 1024,
  /** Level-1 elements walked after the Segment start while looking for the SeekHead. */
  maxTopLevelElements: 32,
};

/** Length of every transcode segment. */
export const transcodeSegmentMs = 4_000;
