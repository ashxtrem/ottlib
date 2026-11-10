import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { HealthReport } from '@ottlib/shared';
import { healthPath } from '../utils/healthChecks';
import { api } from './apiClient';

export const healthQueryKey = ['health'] as const;

export const fetchHealth = (fresh: boolean) => api<HealthReport>(healthPath(fresh));

/** The server's health checks (cached there for 60 s); `checkAgain` runs them all again and replaces the shown report. */
export function useHealth() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: healthQueryKey, queryFn: () => fetchHealth(false), staleTime: 30_000 });
  const checkAgain = useMutation({ mutationFn: () => fetchHealth(true), onSuccess: (report) => client.setQueryData(healthQueryKey, report) });
  return { query, checkAgain };
}
