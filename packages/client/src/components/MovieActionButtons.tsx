import type { Movie } from '@ottlib/shared';
import { Link } from 'react-router-dom';
import { PlayButton } from './PlayButton';
import { PlayMoreMenu } from './PlayMoreMenu';
import { RevealInFolderButton } from './RevealInFolderButton';
import { focusRing, pressable } from './interactionStyles';
import { useTorrentSearchEnabled } from '../hooks/useTorrentSearchEnabled';

const secondaryButtonClassName = `inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border-strong text-foreground transition-[background-color,transform] duration-fast ease-emphasis hover:bg-surface-raised ${focusRing} ${pressable} disabled:cursor-not-allowed disabled:opacity-60`;

type MovieActionButtonsProps = {
  imdbUrl: string;
  movie: Movie;
  onManageShelves: () => void;
  onSubtitles: () => void;
  onToggleWatched: () => void;
  watchPending: boolean;
  hidden: boolean;
  onToggleHidden: () => void;
};

export function MovieActionButtons({ imdbUrl, movie, onManageShelves, onSubtitles, onToggleWatched, watchPending, hidden, onToggleHidden }: MovieActionButtonsProps) {
  const watchLabel = movie.watched ? 'Mark as unwatched' : 'Mark as watched';
  const hideLabel = hidden ? (movie.showKey ? 'Unhide this show' : 'Unhide this title') : (movie.showKey ? 'Hide this show on this device' : 'Hide this title on this device');
  const torrentSearchEnabled = useTorrentSearchEnabled();

  return <div className="space-y-2">
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1"><PlayButton movie={movie} /></div>
      <PlayMoreMenu movie={movie} />
    </div>
    <button type="button" onClick={onSubtitles} disabled={movie.missing} className={`rounded-lg border border-border-strong px-4 py-2 text-sm hover:bg-surface-raised disabled:opacity-50 ${focusRing}`}>Find subtitles</button>
    {torrentSearchEnabled && <Link to={`/torrents?q=${encodeURIComponent(movie.title)}${movie.year ? `&year=${movie.year}` : ''}`} className={`inline-flex rounded-lg px-4 py-2 text-sm font-medium transition-[background-color,transform] duration-fast ease-emphasis ${pressable} ${focusRing} ${movie.missing ? 'bg-warning text-warning-foreground hover:brightness-95' : 'border border-border-strong hover:bg-surface-raised'}`}>{movie.missing ? 'Find replacement' : 'Find this'}</Link>}
    <div className="flex flex-wrap items-center gap-2">
      <RevealInFolderButton movieId={movie.id} />
      <a href={imdbUrl} target="_blank" rel="noopener noreferrer" title="View on IMDb" aria-label="View on IMDb" className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border border-imdb-hover/70 text-imdb-hover transition-[background-color,transform] duration-fast ease-emphasis hover:bg-imdb-hover/10 ${pressable} ${focusRing} focus-visible:outline-imdb-hover`}>
        <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M4 3h16v18H4V3Zm2 2v14h12V5H6Zm2 2h2v10H8V7Zm3.5 0H14v10h-2.5V7Zm4 0H16v10h-1.5V7Z" /></svg>
        <span className="sr-only">View on IMDb</span>
      </a>
      <button type="button" onClick={onManageShelves} title="Manage shelves" aria-label="Manage shelves" className={secondaryButtonClassName}>
        <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-11Z" /><path d="M8 9h8M8 13h5" /></svg>
        <span className="sr-only">Manage shelves</span>
      </button>
      <button type="button" onClick={onToggleWatched} disabled={watchPending} title={watchLabel} aria-label={watchLabel} className={secondaryButtonClassName}>
        {watchPending ? <svg aria-hidden="true" className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 12a8 8 0 1 1-2.34-5.66" /></svg> : movie.watched ? <svg aria-hidden="true" className="h-5 w-5 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 12 4 4L19 6" /></svg> : <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="8.5" /><path d="m8.5 12 2.3 2.3 4.8-4.8" /></svg>}
        <span className="sr-only">{watchLabel}</span>
      </button>
      <button type="button" onClick={onToggleHidden} aria-pressed={hidden} title={hideLabel} aria-label={hideLabel} className={secondaryButtonClassName}>
        {hidden ? <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg> : <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3l18 18M10.6 5.6A10 10 0 0 1 12 5.5c6.4 0 10 6.5 10 6.5a17 17 0 0 1-3.2 3.9M6.5 7.2A17 17 0 0 0 2 12s3.6 6.5 10 6.5a9.6 9.6 0 0 0 4-.9M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>}
        <span className="sr-only">{hideLabel}</span>
      </button>
    </div>
  </div>;
}
