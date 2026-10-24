import { useEffect, useState } from 'react';
import { focusRing } from '../interactionStyles';
import { formatClock } from '../../utils/playerTime';

/** How long "Resumed at · Start over" stays up. */
export const RESUME_CHIP_MS = 5_000;

interface ResumeChipProps {
  positionMs: number;
  onStartOver: () => void;
}

/** "Resumed at 41:20 · Start over", shown for 5 s when playback opens at the saved position. */
export function ResumeChip({ positionMs, onStartOver }: ResumeChipProps) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), RESUME_CHIP_MS);
    return () => clearTimeout(timer);
  }, []);
  if (!visible) return null;
  return <div className="pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center md:top-6">
    <div role="status" className="pointer-events-auto flex animate-pop-in items-center gap-1 rounded-full bg-neutral-900/90 py-1 pl-4 pr-1 text-sm shadow-xl">
      <span>Resumed at {formatClock(positionMs)}</span>
      <span aria-hidden="true" className="text-white/40">·</span>
      <button type="button" onClick={() => { onStartOver(); setVisible(false); }} className={`min-h-9 rounded-full px-3 font-semibold text-accent hover:bg-white/10 ${focusRing}`}>Start over</button>
    </div>
  </div>;
}
