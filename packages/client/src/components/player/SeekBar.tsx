import { useState } from 'react';
import { focusRing } from '../interactionStyles';
import { formatClock } from '../../utils/playerTime';

interface SeekBarProps {
  positionMs: number;
  durationMs: number;
  bufferedMs: number;
  onSeek: (ms: number) => void;
}

const percent = (part: number, whole: number) => `${Math.min(100, Math.max(0, (part / whole) * 100))}%`;

/** The timeline: played and buffered ranges under a native range input (keyboard, touch and screen readers for free). */
export function SeekBar({ positionMs: playedMs, durationMs, bufferedMs, onSeek }: SeekBarProps) {
  // While dragging (or holding an arrow key) the bar follows locally; the seek goes out once, on release, so a
  // transcoded stream isn't restarted for every step.
  const [dragMs, setDragMs] = useState<number | null>(null);
  const commit = () => { if (dragMs !== null) { onSeek(dragMs); setDragMs(null); } };
  const positionMs = dragMs ?? playedMs;
  const known = Number.isFinite(durationMs) && durationMs > 0;
  const whole = known ? durationMs : 1;
  return <div className="relative flex h-6 items-center md:h-5">
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
      onChange={(event) => setDragMs(Number(event.currentTarget.value) * 1000)}
      onPointerUp={commit}
      onKeyUp={commit}
      onBlur={commit}
      className={`relative h-6 w-full cursor-pointer appearance-none bg-transparent disabled:cursor-default md:h-5 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white ${focusRing}`}
    />
  </div>;
}
