import { useRef, useState } from 'react';
import { focusRing } from '../interactionStyles';
import { formatClock } from '../../utils/playerTime';
import { previewLeftPx, thumbCenterPx } from '../../utils/scrubTiming';
import { ScrubPreview, previewWidthPx } from './ScrubPreview';

interface SeekBarProps {
  positionMs: number;
  durationMs: number;
  bufferedMs: number;
  /** The release (pointer up, key up): one exact seek. */
  onSeek: (ms: number) => void;
  /** Fired while dragging, with the time under the thumb (direct play moves the picture, HLS loads a preview frame). */
  onScrub?: (ms: number) => void;
  /** The drag ended (before `onSeek`). */
  onScrubEnd?: () => void;
  /** True: the preview shows a frame (server HLS). False or absent: the time alone. */
  previewFrame?: boolean;
  /** The latest preview frame, or null until the first one lands. */
  frameSrc?: string | null;
}

interface Drag {
  ms: number;
  /** Preview's left edge in px from the bar, computed with the bar's place on screen when the value changed. */
  leftPx: number;
}

const percent = (part: number, whole: number) => `${Math.min(100, Math.max(0, (part / whole) * 100))}%`;

/** The timeline: played and buffered ranges under a native range input (keyboard, touch and screen readers for free). */
export function SeekBar({ positionMs: playedMs, durationMs, bufferedMs, onSeek, onScrub, onScrubEnd, previewFrame = false, frameSrc = null }: SeekBarProps) {
  // While dragging (or holding an arrow key) the bar follows locally; the seek goes out once, on release, so a
  // transcoded stream isn't restarted for every step. `onScrub` is what moves while dragging.
  const [drag, setDrag] = useState<Drag | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const dragMs = drag?.ms ?? null;
  const commit = () => {
    if (dragMs === null) return;
    onScrubEnd?.();
    onSeek(dragMs);
    setDrag(null);
  };
  const moveTo = (ms: number) => {
    const bar = barRef.current?.getBoundingClientRect();
    const leftPx = bar
      ? previewLeftPx({ centerPx: thumbCenterPx(ms, durationMs, bar.width), widthPx: previewWidthPx(previewFrame), barLeftPx: bar.left, viewportWidthPx: document.documentElement.clientWidth })
      : 0;
    setDrag({ ms, leftPx });
    onScrub?.(ms);
  };
  const positionMs = dragMs ?? playedMs;
  const known = Number.isFinite(durationMs) && durationMs > 0;
  const whole = known ? durationMs : 1;
  return <div ref={barRef} className="relative flex h-6 items-center md:h-5">
    <div className="pointer-events-none absolute inset-x-0 h-1 overflow-hidden rounded-full bg-white/20">
      <div className="absolute inset-y-0 left-0 bg-white/40" style={{ width: known ? percent(bufferedMs, whole) : '0%' }} />
      <div className="absolute inset-y-0 left-0 bg-accent" style={{ width: known ? percent(positionMs, whole) : '0%' }} />
    </div>
    <input
      type="range"
      aria-label="Seek"
      aria-valuetext={`${formatClock(positionMs)} of ${formatClock(durationMs)}`}
      min={0}
      max={known ? Math.round(durationMs / 1000) : 0}
      step={1}
      value={Math.round(Math.min(positionMs, whole) / 1000)}
      disabled={!known}
      onChange={(event) => moveTo(Number(event.currentTarget.value) * 1000)}
      onPointerUp={commit}
      onPointerCancel={commit}
      onKeyUp={commit}
      onBlur={commit}
      className={`relative h-6 w-full cursor-pointer appearance-none bg-transparent disabled:cursor-default md:h-5 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white ${focusRing}`}
    />
    {drag && <ScrubPreview timeMs={drag.ms} withFrame={previewFrame} frameSrc={frameSrc} leftPx={drag.leftPx} />}
  </div>;
}
