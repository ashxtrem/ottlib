import type { Movie } from '@ottlib/shared';
import { focusRing } from '../interactionStyles';
import type { UpNextPhase } from '../../utils/upNextTiming';

interface UpNextOverlayProps {
  next: Movie;
  phase: Extract<UpNextPhase, { kind: 'preview' | 'countdown' }>;
  onPlayNow: () => void;
  onCancel: () => void;
}

function episodeLabel(movie: Movie): string | null {
  return movie.season !== null && movie.episode !== null ? `S${movie.season} · E${movie.episode}` : null;
}

/** Bottom-right card: the next episode while the last 20 s play, then a countdown after the end. */
export function UpNextOverlay({ next, phase, onPlayNow, onCancel }: UpNextOverlayProps) {
  const episode = episodeLabel(next);
  const heading = phase.kind === 'countdown' ? `Up next in ${phase.secondsLeft}` : 'Up next';
  return <section aria-label="Up next" aria-live="polite" className="absolute bottom-28 left-3 right-3 z-20 flex animate-pop-in gap-3 rounded-xl border border-white/10 bg-neutral-900/90 p-3 shadow-2xl md:bottom-32 md:left-auto md:right-6 md:w-96">
    {next.posterUrl && <img src={next.posterUrl} alt="" className="hidden h-24 w-16 shrink-0 rounded object-cover sm:block" />}
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-white/60">{heading}</p>
      <p className="truncate font-semibold">{next.title}</p>
      {episode && <p className="text-xs text-white/60">{episode}</p>}
      <div className="mt-auto flex gap-2 pt-1">
        <button type="button" onClick={onPlayNow} className={`min-h-11 flex-1 rounded-lg bg-white px-3 text-sm font-semibold text-black hover:bg-white/90 md:min-h-9 ${focusRing}`}>Play now</button>
        <button type="button" onClick={onCancel} className={`min-h-11 flex-1 rounded-lg bg-white/10 px-3 text-sm hover:bg-white/20 md:min-h-9 ${focusRing}`}>Cancel</button>
      </div>
    </div>
  </section>;
}
