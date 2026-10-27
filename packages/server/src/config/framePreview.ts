/** Seek-bar frame previews: one small keyframe JPEG per request, grabbed by ffmpeg. */
export const framePreviewConfig = {
  /** ffmpeg runs at once, server-wide; the rest wait in a queue. */
  maxConcurrent: 2,
  /** Frames kept in memory (least recently used go first). A frame is 3-8 KB. */
  cacheSize: 300,
  /** The requested time is rounded to this before ffmpeg runs, so a scrub reuses frames. */
  roundMs: 2000,
  /** Upper bound on t when the title's duration is unknown (24 h). */
  maxUnknownMs: 86_400_000,
  /** Output frame width in pixels; the height follows the aspect ratio (kept even). */
  width: 320,
  /** mjpeg quality scale (2 best, 31 worst). */
  quality: 5,
  /** One grab may take at most this long. */
  timeoutMs: 15_000,
  /** How long a browser or app may reuse a frame without asking again. */
  cacheControl: 'private, max-age=3600',
};
