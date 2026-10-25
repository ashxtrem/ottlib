/** Picture-area (burned-in black bar) detection: where to sample and when to trust the result. */
export const pictureAreaConfig = {
  /** Sample points spread evenly over [rangeStart, rangeEnd] of the runtime. */
  samplePoints: 8,
  rangeStart: 0.1,
  rangeEnd: 0.9,
  /** Frames analysed per sample point. */
  framesPerSample: 3,
  /** cropdetect `limit` (fractional, so it works for 8 and 10-bit) and `round`. */
  cropLimit: 0.1,
  cropRound: 2,
  /** One ffmpeg sample may take at most this long; a timed-out sample is skipped. */
  sampleTimeoutMs: 15_000,
  /** Bars thinner than this fraction of the frame, per side, are ignored (status none). */
  minBarFraction: 0.01,
  /** A union narrower or shorter than this fraction of the frame is not believed (status failed). */
  minAreaFraction: 0.5,
  /** Fewer usable samples than this is a failed detection. */
  minValidSamples: 3,
  /** Rows fetched per batch by the background pass. */
  batchSize: 20,
};
