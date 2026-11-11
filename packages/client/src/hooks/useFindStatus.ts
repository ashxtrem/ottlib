import { useQuery } from '@tanstack/react-query';
import type { FindStatus } from '@ottlib/shared';
import { api } from './apiClient';

/** Whether the Hashlark link is registered on the server PC (and the saved Find mode). */
export function useFindStatus() {
  return useQuery({ queryKey: ['find-status'], queryFn: () => api<FindStatus>('/api/find/status') });
}
