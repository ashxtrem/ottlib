import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AutoSkipDefaults } from '@ottlib/shared';
import { api } from './apiClient';

const key = ['auto-skip-defaults'];

/** The current profile's auto-skip credits defaults per media type (GET/PUT /api/profiles/current/auto-skip). */
export function useAutoSkipDefaults() {
  const client = useQueryClient();
  const defaults = useQuery({ queryKey: key, queryFn: () => api<AutoSkipDefaults>('/api/profiles/current/auto-skip') });
  const update = useMutation({
    mutationFn: (next: AutoSkipDefaults) => api<AutoSkipDefaults>('/api/profiles/current/auto-skip', { method: 'PUT', body: JSON.stringify(next) }),
    onSuccess: (saved) => client.setQueryData(key, saved)
  });
  return { defaults, update };
}
