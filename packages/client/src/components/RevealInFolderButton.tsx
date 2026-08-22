import { useState } from 'react';
import { api } from '../hooks/apiClient';
import { useIsLocalClient } from '../hooks/useIsLocalClient';
import { useToast } from '../hooks/useToast';

const buttonClassName = 'inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border-strong text-foreground transition-colors hover:bg-surface-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60';

export function RevealInFolderButton({ movieId }: { movieId: number }) {
  const [error, setError] = useState<string>();
  const [working, setWorking] = useState(false);
  const { show } = useToast();
  const isLocal = useIsLocalClient();

  const reveal = async () => {
    setError(undefined);
    setWorking(true);
    try {
      await api<void>(`/api/movies/${movieId}/reveal`, { method: 'POST' });
      show('Opened File Explorer with the movie selected.', 'success');
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Unable to show folder';
      setError(message);
      show(message, 'error');
    } finally {
      setWorking(false);
    }
  };

  if (!isLocal) return null;

  return <>
    <button type="button" onClick={reveal} disabled={working} title="Show in folder" aria-label="Show in folder" className={buttonClassName}>
      <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 6.75A1.75 1.75 0 0 1 4.75 5h4l1.7 2h8.8A1.75 1.75 0 0 1 21 8.75v8.5A1.75 1.75 0 0 1 19.25 19h-14A1.75 1.75 0 0 1 3.5 17.25V6.75Z" /><path d="M3.5 10h17" /></svg>
      <span className="sr-only">Show in folder</span>
    </button>
    {error && <p className="basis-full text-sm text-error">{error}</p>}
  </>;
}
