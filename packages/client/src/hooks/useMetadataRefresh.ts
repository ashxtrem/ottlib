import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ScanRun } from '@ottlib/shared';
import { api } from './apiClient';

type MetadataRefreshStatus = ScanRun | { status: 'idle' };

export function useMetadataRefresh() {
  const client = useQueryClient();
  const status = useQuery({ queryKey: ['metadata-refresh'], queryFn: () => api<MetadataRefreshStatus>('/api/movies/metadata-refresh/status'), refetchInterval: (query) => query.state.data?.status === 'running' ? 1200 : false });
  const previousStatus = useRef<MetadataRefreshStatus['status'] | undefined>(undefined);
  useEffect(() => {
    if (previousStatus.current === 'running' && status.data?.status !== 'running') {
      void client.invalidateQueries({ queryKey: ['movies'] });
      void client.invalidateQueries({ queryKey: ['movie'] });
      void client.invalidateQueries({ queryKey: ['movie-duplicates'] });
      void client.invalidateQueries({ queryKey: ['shelf'] });
      void client.invalidateQueries({ queryKey: ['movie-filter-options'] });
      void client.invalidateQueries({ queryKey: ['suggested-movie-count'] });
      void client.invalidateQueries({ queryKey: ['auto-accept-backfill'] });
    }
    previousStatus.current = status.data?.status;
  }, [client, status.data?.status]);
  const start = useMutation({
    mutationFn: (movieIds?: number[]) => api<ScanRun>('/api/movies/metadata-refresh', { method: 'POST', body: JSON.stringify(movieIds ? { movieIds } : {}) }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['metadata-refresh'] })
  });
  return { status, start };
}
