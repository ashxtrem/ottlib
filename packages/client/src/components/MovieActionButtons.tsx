import type { Movie } from '@ottlib/shared';
import { PlayButton } from './PlayButton';
import { RevealInFolderButton } from './RevealInFolderButton';

const secondaryButtonClassName = 'inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border-strong text-foreground transition-colors hover:bg-surface-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60';

type MovieActionButtonsProps = {
  imdbUrl: string;
  movie: Movie;
  onManageShelves: () => void;
  onToggleWatched: () => void;
  watchPending: boolean;
};

export function MovieActionButtons({ imdbUrl, movie, onManageShelves, onToggleWatched, watchPending }: MovieActionButtonsProps) {
  const watchLabel = movie.watched ? 'Mark as unwatched' : 'Mark as watched';

  return <div className="space-y-2">
    <PlayButton movie={movie} />
    <div className="flex flex-wrap items-center gap-2">
      <RevealInFolderButton movieId={movie.id} />
      <a href={imdbUrl} target="_blank" rel="noopener noreferrer" title="View on IMDb" aria-label="View on IMDb" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-imdb-hover/70 text-imdb-hover hover:bg-imdb-hover/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-imdb-hover">
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
    </div>
  </div>;
}
