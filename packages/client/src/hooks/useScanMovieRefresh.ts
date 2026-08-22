import { useEffect, useRef } from 'react';

const liveRefreshIntervalMs = 15_000;

export function useScanMovieRefresh(status: 'idle' | 'running' | 'completed' | 'failed' | undefined, refreshMovies: () => Promise<unknown>): void {
  const previousStatus = useRef(status);
  const refreshMoviesRef = useRef(refreshMovies);

  useEffect(() => {
    refreshMoviesRef.current = refreshMovies;
  }, [refreshMovies]);

  useEffect(() => {
    if (previousStatus.current === 'running' && status === 'completed') void refreshMoviesRef.current();
    previousStatus.current = status;
  }, [status]);

  useEffect(() => {
    if (status !== 'running') return;
    const interval = window.setInterval(() => void refreshMoviesRef.current(), liveRefreshIntervalMs);
    return () => window.clearInterval(interval);
  }, [status]);
}
