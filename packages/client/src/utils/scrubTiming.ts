/** Scrubbing the seek bar: how often the picture or the preview frame may update while dragging, and where the preview sits. */

/** At most one live seek (direct play) or one frame request (server HLS) per this long while dragging. */
export const SCRUB_INTERVAL_MS = 150;

/** The server rounds a frame's time to this (its `framePreviewConfig.roundMs`), so rounding here too makes browser and server caches hit. */
export const FRAME_STEP_MS = 2000;

/** Width of the preview frame in px (phones included). */
export const PREVIEW_FRAME_WIDTH = 160;
/** Width of the time-only preview in px (direct play). */
export const PREVIEW_TIME_WIDTH = 64;
/** Room kept between the preview and the edge of the viewport. */
export const PREVIEW_EDGE_MARGIN = 8;
/** The seek bar's thumb is 16 px wide; its centre travels the bar minus that. */
export const THUMB_SIZE = 16;

export interface Throttled<T> {
  (value: T): void;
  /** Drops a pending trailing call. */
  cancel(): void;
}

/**
 * Runs `run` at most once per `intervalMs`: the first call goes out at once (leading), calls within the interval are
 * folded into one that goes out when the interval is over (trailing), carrying the last value. `cancel` drops that one.
 */
export function createThrottle<T>(run: (value: T) => void, intervalMs: number, now: () => number = Date.now): Throttled<T> {
  let lastRunAt = Number.NEGATIVE_INFINITY;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: { value: T } | null = null;
  const flush = () => {
    timer = undefined;
    if (!pending) return;
    const { value } = pending;
    pending = null;
    lastRunAt = now();
    run(value);
  };
  const throttled = ((value: T) => {
    const elapsed = now() - lastRunAt;
    if (timer === undefined && elapsed >= intervalMs) {
      lastRunAt = now();
      run(value);
      return;
    }
    pending = { value };
    if (timer === undefined) timer = setTimeout(flush, Math.max(0, intervalMs - elapsed));
  }) as Throttled<T>;
  throttled.cancel = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    pending = null;
  };
  return throttled;
}

/** The time a frame is asked for: rounded to the server's step, not below 0, and one step short of a known end (EOF has no frame). */
export function frameTimeMs(ms: number, durationMs: number | null): number {
  const rounded = Math.round(Math.max(0, Number.isFinite(ms) ? ms : 0) / FRAME_STEP_MS) * FRAME_STEP_MS;
  const last = durationMs !== null && Number.isFinite(durationMs) && durationMs > 0 ? Math.max(0, durationMs - FRAME_STEP_MS) : Number.POSITIVE_INFINITY;
  return Math.min(rounded, last);
}

/** `framePreviewUrl` always carries a query string (`?key=<k>` or a bare `?`), so the time is one more parameter. */
export function frameUrl(framePreviewUrl: string, timeMs: number): string {
  return `${framePreviewUrl}&t=${timeMs}`;
}

/** Where the thumb's centre is, in px from the bar's left edge. */
export function thumbCenterPx(ms: number, durationMs: number, barWidthPx: number): number {
  const fraction = durationMs > 0 ? Math.min(1, Math.max(0, ms / durationMs)) : 0;
  return THUMB_SIZE / 2 + fraction * Math.max(0, barWidthPx - THUMB_SIZE);
}

export interface PreviewPlacement {
  /** Centre of the thumb, px from the bar's left edge. */
  centerPx: number;
  widthPx: number;
  /** The bar's left edge, px from the viewport's left edge. */
  barLeftPx: number;
  viewportWidthPx: number;
  marginPx?: number;
}

/**
 * The preview's left edge in px from the bar's left edge: centred on the thumb, but kept `marginPx` inside the viewport
 * at both ends (on a viewport narrower than the preview, the left edge wins).
 */
export function previewLeftPx({ centerPx, widthPx, barLeftPx, viewportWidthPx, marginPx = PREVIEW_EDGE_MARGIN }: PreviewPlacement): number {
  const ideal = centerPx - widthPx / 2;
  const min = marginPx - barLeftPx;
  const max = viewportWidthPx - marginPx - widthPx - barLeftPx;
  return Math.max(min, Math.min(ideal, max));
}
