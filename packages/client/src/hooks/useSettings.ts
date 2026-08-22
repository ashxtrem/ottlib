import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import type { AutoAcceptBackfillStatus, Folder, ScanRun, Settings, UpdateSettings } from '@ottlib/shared';
import { api } from './apiClient';
import { useToast } from './useToast';

export function useSettings() { return useQuery({ queryKey: ['settings'], queryFn: () => api<Settings>('/api/settings') }); }
export function useFolders() { return useQuery({ queryKey: ['folders'], queryFn: () => api<Folder[]>('/api/folders') }); }
type AutoAcceptBackfillRunStatus = ScanRun | { status: 'idle' };
export function useAutoAcceptBackfillRunStatus() { return useQuery({ queryKey: ['auto-accept-backfill-run'], queryFn: () => api<AutoAcceptBackfillRunStatus>('/api/movies/backfill-auto-accept/status'), refetchInterval: (query) => query.state.data?.status === 'running' ? 1200 : false }); }
export function useAutoAcceptBackfill() {
  const client = useQueryClient();
  const status = useQuery({ queryKey: ['auto-accept-backfill'], queryFn: () => api<AutoAcceptBackfillStatus>('/api/movies/backfill-auto-accept') });
  const runStatus = useAutoAcceptBackfillRunStatus();
  const previousRunStatus = useRef<AutoAcceptBackfillRunStatus['status'] | undefined>(undefined);
  useEffect(() => {
    if (previousRunStatus.current === 'running' && runStatus.data?.status !== 'running') {
      void client.invalidateQueries({ queryKey: ['auto-accept-backfill'] });
      void client.invalidateQueries({ queryKey: ['movies'] });
      void client.invalidateQueries({ queryKey: ['suggested-movie-count'] });
      void client.invalidateQueries({ queryKey: ['movie-filter-options'] });
    }
    previousRunStatus.current = runStatus.data?.status;
  }, [client, runStatus.data?.status]);
  const run = useMutation({
    mutationFn: () => api<ScanRun>('/api/movies/backfill-auto-accept', { method: 'POST' }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['auto-accept-backfill-run'] });
    }
  });
  return { status, run, runStatus };
}
export function useSettingsActions() {
  const client = useQueryClient(); const { show } = useToast(); const refresh = () => client.invalidateQueries({ queryKey: ['settings'] });
  const update = useMutation({ mutationFn: (settings: UpdateSettings) => api<Settings>('/api/settings', { method: 'PUT', body: JSON.stringify(settings) }), onSuccess: () => { refresh(); show('Settings saved.', 'success'); }, onError: (error) => show(error.message, 'error') });
  const testTmdbKey = useMutation({ mutationFn: (tmdbApiKey: string) => api<{ valid: true }>('/api/settings/tmdb/test', { method: 'POST', body: JSON.stringify({ tmdbApiKey }) }), onSuccess: () => show('TMDb key is valid.', 'success'), onError: (error) => show(error.message, 'error') });
  const addFolder = useMutation({ mutationFn: (path: string) => api<Folder>('/api/folders', { method: 'POST', body: JSON.stringify({ path }) }), onSuccess: () => { client.invalidateQueries({ queryKey: ['folders'] }); show('Scan folder added.', 'success'); }, onError: (error) => show(error.message, 'error') });
  const pickFolder = useMutation({ mutationFn: () => api<{ path: string | null }>('/api/folders/select', { method: 'POST' }), onError: (error) => show(error.message, 'error') });
  const removeFolder = useMutation({ mutationFn: (id: number) => api<void>(`/api/folders/${id}`, { method: 'DELETE' }), onSuccess: () => { client.invalidateQueries({ queryKey: ['folders'] }); show('Scan folder removed.', 'success'); }, onError: (error) => show(error.message, 'error') });
  return { update, testTmdbKey, addFolder, pickFolder, removeFolder };
}
