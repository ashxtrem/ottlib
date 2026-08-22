import { Link } from 'react-router-dom';
import { ApiError } from '../hooks/apiClient';

type Resource = 'library' | 'shelf' | 'title';

interface ErrorStateProps {
  resource: Resource;
  error?: Error | null;
  retrying?: boolean;
  onRetry: () => void | Promise<unknown>;
}

const missingMessages: Record<Exclude<Resource, 'library'>, string> = {
  title: 'This title is no longer in your library — it may have been removed in the last scan.',
  shelf: 'This shelf is no longer available — it may have been deleted.'
};

export function ErrorState({ resource, error, retrying, onRetry }: ErrorStateProps) {
  const missing = !error || (error instanceof ApiError && error.status === 404);
  const message = missing && resource !== 'library' ? missingMessages[resource] : "Couldn't reach the server. Check your connection and try again.";
  const heading = missing ? `${resource === 'title' ? 'Title' : 'Shelf'} unavailable` : "Couldn't reach the server";
  return <section className="rounded-xl border border-error-border bg-error-soft/30 p-6 text-center" role="alert"><h1 className="text-xl font-semibold text-foreground">{heading}</h1><p className="mx-auto mt-2 max-w-lg text-sm text-muted">{message}</p><div className="mt-5 flex flex-wrap justify-center gap-3"><button type="button" onClick={() => void onRetry()} disabled={retrying} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60">{retrying ? 'Trying again…' : 'Try again'}</button><Link to="/" className="rounded-lg border border-border-strong px-4 py-2 text-sm font-medium hover:bg-surface-raised">Back to library</Link></div></section>;
}
