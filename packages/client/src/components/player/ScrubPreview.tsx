import { formatClock } from '../../utils/playerTime';
import { PREVIEW_FRAME_WIDTH, PREVIEW_TIME_WIDTH } from '../../utils/scrubTiming';

interface ScrubPreviewProps {
  /** The time under the thumb. */
  timeMs: number;
  /** True for server HLS: a frame above the time. False (direct play): the time alone, the picture itself moves. */
  withFrame: boolean;
  /** The latest preview frame; null until the first one lands. */
  frameSrc: string | null;
  /** Left edge in px from the seek bar's left edge (already kept inside the viewport). */
  leftPx: number;
}

/** The width the preview takes, for placing it inside the viewport. */
export function previewWidthPx(withFrame: boolean): number {
  return withFrame ? PREVIEW_FRAME_WIDTH : PREVIEW_TIME_WIDTH;
}

/**
 * The bubble above the seek bar's thumb while dragging: a 160 px frame and the time (or the time alone). Sits on the
 * video, so it keeps the same dark look in light and dark themes.
 */
export function ScrubPreview({ timeMs, withFrame, frameSrc, leftPx }: ScrubPreviewProps) {
  return <div
    data-testid="scrub-preview"
    aria-hidden="true"
    style={{ left: leftPx, width: previewWidthPx(withFrame) }}
    className="pointer-events-none absolute bottom-full z-20 mb-2 flex flex-col items-center gap-1 overflow-hidden rounded-md bg-neutral-900/95 p-1 text-white shadow-xl ring-1 ring-white/20 dark:bg-black/90"
  >
    {withFrame && <div className="aspect-video w-full overflow-hidden rounded bg-black">
      {frameSrc && <img src={frameSrc} alt="" draggable={false} className="h-full w-full object-contain" />}
    </div>}
    <span className="text-xs font-semibold tabular-nums">{formatClock(timeMs)}</span>
  </div>;
}
