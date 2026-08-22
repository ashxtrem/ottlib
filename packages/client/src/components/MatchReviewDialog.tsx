import { useMatchCandidates, useMovie, useMovieActions } from '../hooks/useMovies';
import { useAutoAcceptBackfill } from '../hooks/useSettings';
import { MatchCandidateRow } from './MatchCandidateRow';
import { Modal } from './Modal';

interface MatchReviewDialogProps {
  open: boolean;
  movieId: number;
  title: string;
  year: number | null;
  onClose: () => void;
}

export function MatchReviewDialog({ open, movieId, title, year, onClose }: MatchReviewDialogProps) {
  const movie = useMovie(String(movieId));
  const candidates = useMatchCandidates(String(movieId), open);
  const actions = useMovieActions();
  const autoAcceptBackfill = useAutoAcceptBackfill();
  if (!open) return null;

  const accept = (candidateId: number, season?: number, episode?: number) => {
    actions.acceptCandidate.mutate({ id: movieId, candidateId, season, episode }, { onSuccess: onClose });
  };
  const dismiss = () => actions.rejectCandidates.mutate(movieId, { onSuccess: onClose });
  const topCandidate = candidates.data?.[0] ? candidates.data.reduce((top, candidate) => candidate.score > top.score ? candidate : top) : undefined;
  const eligibleCount = autoAcceptBackfill.status.data?.eligible ?? 0;

  return <Modal open title="Review match" subtitle={`${title}${year ? ` (${year})` : ''}`} onClose={onClose} maxWidthClassName="max-w-2xl" panelClassName="border-warning-border/50" footer={<><button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-foreground/90 hover:bg-surface-raised">Close</button>{candidates.data && candidates.data.length > 0 && <button type="button" onClick={dismiss} disabled={actions.rejectCandidates.isPending} className="rounded-lg px-4 py-2 text-sm text-muted hover:bg-surface-raised hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60">None of these</button>}</>}>
    <div className="min-h-0 flex-1 overflow-y-auto p-5">
      <p className="text-sm text-muted">Choose the matching title for <span className="font-medium text-foreground">{movie.data?.rawFilename ?? 'this file'}</span>.</p>
      {topCandidate && topCandidate.score > 0.75 && eligibleCount > 0 && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent-soft-border bg-accent-soft p-3 text-sm text-accent-soft-foreground"><p>This title's top match scored {topCandidate.score.toFixed(2)} — accept all {eligibleCount} confident matches like it?</p><button type="button" onClick={() => autoAcceptBackfill.run.mutate(undefined, { onSuccess: onClose })} disabled={autoAcceptBackfill.run.isPending} className="rounded-lg bg-accent px-3 py-1.5 font-medium text-accent-foreground hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60">{autoAcceptBackfill.run.isPending ? 'Accepting…' : 'Accept all'}</button>{autoAcceptBackfill.run.error && <p className="w-full text-error">{autoAcceptBackfill.run.error.message}</p>}</div>}
      {candidates.isLoading && <p className="mt-4 text-sm text-muted">Loading suggestions…</p>}
      {candidates.error && <p className="mt-4 text-sm text-error">{candidates.error.message}</p>}
      {candidates.data && candidates.data.length === 0 && <p className="mt-4 text-sm text-muted">No suggestions are available.</p>}
      <ul className="mt-4 space-y-2">{candidates.data?.map((candidate) => <MatchCandidateRow key={candidate.id} candidate={candidate} rawFilename={movie.data?.rawFilename ?? title} pending={actions.acceptCandidate.isPending} onAccept={(season, episode) => accept(candidate.id, season, episode)} />)}</ul>
    </div>
  </Modal>;
}
