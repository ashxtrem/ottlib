import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Folder, Settings, UpdateSettings } from '@ottlib/shared';
import { api } from './apiClient';
import { useToast } from './useToast';

export function useSettings() { return useQuery({ queryKey: ['settings'], queryFn: () => api<Settings>('/api/settings') }); }
export function useFolders() { return useQuery({ queryKey: ['folders'], queryFn: () => api<Folder[]>('/api/folders') }); }
export function useSettingsActions() {
  const client = useQueryClient(); const { show } = useToast(); const refresh = () => client.invalidateQueries({ queryKey: ['settings'] });
  const update = useMutation({ mutationFn: (settings: UpdateSettings) => api<Settings>('/api/settings', { method: 'PUT', body: JSON.stringify(settings) }), onSuccess: () => { refresh(); show('Settings saved.', 'success'); }, onError: (error) => show(error.message, 'error') });
  const addFolder = useMutation({ mutationFn: (path: string) => api<Folder>('/api/folders', { method: 'POST', body: JSON.stringify({ path }) }), onSuccess: () => { client.invalidateQueries({ queryKey: ['folders'] }); show('Scan folder added.', 'success'); }, onError: (error) => show(error.message, 'error') });
  const pickFolder = useMutation({ mutationFn: () => api<{ path: string | null }>('/api/folders/select', { method: 'POST' }), onError: (error) => show(error.message, 'error') });
  const removeFolder = useMutation({ mutationFn: (id: number) => api<void>(`/api/folders/${id}`, { method: 'DELETE' }), onSuccess: () => { client.invalidateQueries({ queryKey: ['folders'] }); show('Scan folder removed.', 'success'); }, onError: (error) => show(error.message, 'error') });
  return { update, addFolder, pickFolder, removeFolder };
}
