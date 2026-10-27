/** Subtitle lines drawn inside the visible player box (not inside the `<video>`, which can be larger than the box). */
export function CueOverlay({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null;
  return <div aria-live="off" className="pointer-events-none absolute inset-x-0 bottom-20 z-[5] flex flex-col items-center gap-1 px-4 text-center md:bottom-24">
    {lines.map((line, index) => <span
      key={`${index}-${line}`}
      className="max-w-[90%] rounded bg-black/60 px-2 py-0.5 text-base font-medium leading-snug text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.9)] md:text-xl lg:text-2xl"
    >{line}</span>)}
  </div>;
}
