import { useMutation, useQuery, useQueryClient, type Query } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { ProfileSelectResult, ProfileSummary } from '@ottlib/shared';
import { api, ApiError } from './apiClient';
import { clearProfileToken, profileRequiredEvent, setLastProfileId, setProfileToken } from './profileSession';

export const profileKeys = { all: ['profile'], me: ['profile', 'me'], list: ['profile', 'list'] } as const;

/** `null` means the server wants a profile picked first; the gate then shows the picker. */
export type CurrentProfile = { profile: ProfileSummary } | null;

async function fetchCurrentProfile(): Promise<CurrentProfile> {
  try { return await api<{ profile: ProfileSummary }>('/api/profiles/me'); } catch (error) {
    if (error instanceof ApiError && error.status === 409 && error.code === 'PROFILE_REQUIRED') return null;
    throw error;
  }
}

/** The profile this browser acts as. Any request answered with PROFILE_REQUIRED drops it, which shows the picker. */
export function useCurrentProfile() {
  const client = useQueryClient();
  useEffect(() => {
    // Set, not invalidate: refetching /me would answer 409 again and fire this event in a loop.
    const showPicker = () => client.setQueryData<CurrentProfile>(profileKeys.me, null);
    window.addEventListener(profileRequiredEvent, showPicker);
    return () => window.removeEventListener(profileRequiredEvent, showPicker);
  }, [client]);
  return useQuery({ queryKey: profileKeys.me, queryFn: fetchCurrentProfile, staleTime: Infinity, retry: 1 });
}

export function useProfiles() {
  return useQuery({ queryKey: profileKeys.list, queryFn: () => api<ProfileSummary[]>('/api/profiles') });
}

// The access-PIN status and profile data are not per profile; everything else is reloaded for the new profile.
const keptAcrossProfiles = (query: Query) => query.queryKey[0] === profileKeys.all[0] || query.queryKey[0] === 'auth-status';

export function useSelectProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, pin }: { id: number; pin?: string }) => api<ProfileSelectResult>(`/api/profiles/${id}/select`, { method: 'POST', body: JSON.stringify(pin ? { pin } : {}) }),
    onSuccess: (result) => {
      setProfileToken(result.token);
      setLastProfileId(result.profile.id);
      client.removeQueries({ predicate: (query) => !keptAcrossProfiles(query) });
      const current: CurrentProfile = { profile: result.profile };
      client.setQueryData<CurrentProfile>(profileKeys.me, current);
      void client.invalidateQueries();
    }
  });
}

/** Ends this browser's profile session; /me then answers PROFILE_REQUIRED (picker) or the single-profile fallback. */
export function useDeselectProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('/api/profiles/deselect', { method: 'POST' }),
    onSettled: () => {
      clearProfileToken();
      void client.invalidateQueries({ queryKey: profileKeys.all });
    }
  });
}
