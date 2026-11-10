import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Backup, RestoreRequestResult } from '@ottlib/shared';
import { api } from './apiClient';

export const backupsQueryKey = ['backups'] as const;

/** The server's database backups plus create, delete and restore. A restore only takes effect when the server restarts. */
export function useBackups() {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: backupsQueryKey });
  const list = useQuery({ queryKey: backupsQueryKey, queryFn: () => api<Backup[]>('/api/backups') });
  const create = useMutation({ mutationFn: () => api<Backup>('/api/backups', { method: 'POST' }), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (name: string) => api<void>(`/api/backups/${encodeURIComponent(name)}`, { method: 'DELETE' }), onSuccess: refresh });
  const restore = useMutation({ mutationFn: (name: string) => api<RestoreRequestResult>(`/api/backups/${encodeURIComponent(name)}/restore`, { method: 'POST' }), onSuccess: refresh });
  return { list, create, remove, restore };
}
