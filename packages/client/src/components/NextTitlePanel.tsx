import type { Movie } from '@ottlib/shared';
import { Link } from 'react-router-dom';
import { focusRing, pressable } from './interactionStyles';
import { watchPath } from '../hooks/useUpNext';
import { episodeGapAfter, nextLabel } from '../utils/nextTitle';

/** "Next episode: …" with a Play next button, as on the Android details screens. Shelf order is kept when opened from a shelf. */
export function NextTitlePanel({ current, next, shelfId }: { current: Movie; next: Movie; shelfId?: number }) {
  const gap = episodeGapAfter(next, current);
  return <div className="space-y-2 rounded-lg border border-border bg-surface-raised/50 p-3">
    <p className="font-medium">{nextLabel(next)}: <Link to={`/movie/${next.id}`} state={shelfId === undefined ? undefined : { fromShelf: true, shelfId }} className={`hover:text-accent hover:underline ${focusRing}`}>{next.title}</Link></p>
    {gap && <p className="text-sm text-muted">{gap}</p>}
    <Link to={watchPath(next.id, shelfId)} className={`inline-flex items-center gap-2 rounded-lg border border-border-strong px-4 py-2 text-sm font-medium transition-[background-color,transform] duration-fast ease-emphasis hover:bg-surface-raised ${pressable} ${focusRing}`}>
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M5 5l9 7-9 7V5Zm11 0h3v14h-3V5Z" /></svg>
      Play next
    </Link>
  </div>;
}
