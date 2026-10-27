/** What else sits at the bottom of the player: the Skip/Watch credits button (low or raised) and up next's card. */
export interface CueClearance {
  upNext: boolean;
  creditsButton: 'low' | 'raised' | null;
}

/** Above the controls; lifted above the credits button (bottom-28/32, ~2.75 rem tall) and up next's card when they show. */
export function cueOverlayPlace({ upNext, creditsButton }: CueClearance): string {
  if (creditsButton === 'raised') return 'bottom-[20rem] md:bottom-[20.5rem]';
  if (upNext) return 'bottom-[16rem] md:bottom-[17rem]';
  if (creditsButton === 'low') return 'bottom-[10.5rem] md:bottom-[11.5rem]';
  return 'bottom-20 md:bottom-24';
}

/** Subtitle lines drawn inside the visible player box (not inside the `<video>`, which can be larger than the box). */
export function CueOverlay({ lines, clearance }: { lines: string[]; clearance?: CueClearance }) {
  if (lines.length === 0) return null;
  const place = cueOverlayPlace(clearance ?? { upNext: false, creditsButton: null });
  return <div aria-live="off" className={`pointer-events-none absolute inset-x-0 z-[5] flex flex-col items-center gap-1 px-4 text-center ${place}`}>
    {lines.map((line, index) => <span
      key={`${index}-${line}`}
      className="max-w-[90%] rounded bg-black/60 px-2 py-0.5 text-base font-medium leading-snug text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.9)] md:text-xl lg:text-2xl"
    >{line}</span>)}
  </div>;
}
