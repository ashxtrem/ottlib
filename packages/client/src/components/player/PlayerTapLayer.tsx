import { useRef, useState, type PointerEvent } from 'react';
import { DOUBLE_TAP_MS, doubleTapSeekSeconds } from '../../utils/playerShortcuts';

interface PlayerTapLayerProps {
  /** Mouse click: play/pause. */
  onTogglePlay: () => void;
  /** Touch tap: show or hide the controls. */
  onToggleControls: () => void;
  onSeekBy: (seconds: number) => void;
}

const PHONE_WIDTH = '(max-width: 767px)';

/**
 * The surface over the video. A mouse click plays/pauses; a tap shows/hides the controls; at phone width a double tap
 * on the left or right third jumps 10 s back or forward (with a brief "−10 s"/"+10 s" hint).
 */
export function PlayerTapLayer({ onTogglePlay, onToggleControls, onSeekBy }: PlayerTapLayerProps) {
  const lastTap = useRef(0);
  const [hint, setHint] = useState<{ seconds: number; at: number } | null>(null);

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') { if (event.button === 0) onTogglePlay(); return; }
    const now = event.timeStamp;
    const isDouble = now - lastTap.current < DOUBLE_TAP_MS;
    lastTap.current = isDouble ? 0 : now;
    const phone = typeof window.matchMedia === 'function' && window.matchMedia(PHONE_WIDTH).matches;
    if (isDouble && phone) {
      const box = event.currentTarget.getBoundingClientRect();
      const seconds = doubleTapSeekSeconds(event.clientX - box.left, box.width);
      if (seconds !== 0) {
        onSeekBy(seconds);
        setHint({ seconds, at: now });
        setTimeout(() => setHint((current) => (current?.at === now ? null : current)), 700);
        return;
      }
    }
    onToggleControls();
  };

  return <div className="absolute inset-0 z-0 select-none" onPointerUp={onPointerUp} aria-hidden="true">
    {hint && <div className={`pointer-events-none absolute top-1/2 -mt-6 rounded-full bg-black/60 px-4 py-2 text-lg font-semibold ${hint.seconds < 0 ? 'left-[12%]' : 'right-[12%]'}`}>
      {hint.seconds < 0 ? `−${-hint.seconds} s` : `+${hint.seconds} s`}
    </div>}
  </div>;
}
