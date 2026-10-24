import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { LocalResetResult, ProfileCreate, ProfilePatch, ProfilePinUpdate, ProfileSummary } from '@ottlib/shared';
import { api } from './apiClient';
import { profileKeys } from './useProfile';
import { useToast } from './useToast';

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

/** Settings → Profiles: add, edit, PIN and delete. Each success reloads the profile list and the current profile. */
export function useProfileActions() {
  const client = useQueryClient(); const { show } = useToast();
  const refresh = () => void client.invalidateQueries({ queryKey: profileKeys.all });
  const create = useMutation({ mutationFn: (input: ProfileCreate) => api<ProfileSummary>('/api/profiles', json('POST', input)), onSuccess: (profile) => { refresh(); show(`Profile ${profile.name} added.`, 'success'); } });
  const update = useMutation({ mutationFn: ({ id, patch }: { id: number; patch: ProfilePatch }) => api<ProfileSummary>(`/api/profiles/${id}`, json('PATCH', patch)), onSuccess: refresh });
  const setPin = useMutation({
    mutationFn: ({ id, input }: { id: number; input: ProfilePinUpdate }) => api<unknown>(`/api/profiles/${id}/pin`, json('PUT', input)),
    onSuccess: (_result, { input }) => { refresh(); show(input.pin === null ? 'Profile PIN removed.' : 'Profile PIN saved.', 'success'); }
  });
  const remove = useMutation({ mutationFn: (id: number) => api<void>(`/api/profiles/${id}`, { method: 'DELETE' }), onSuccess: () => { refresh(); show('Profile deleted.', 'success'); } });
  return { create, update, setPin, remove };
}

/** Clears the owner's PIN and the access PIN. The server only accepts it from its own machine, with the reset header. */
export function useLocalPinReset() {
  const client = useQueryClient(); const { show } = useToast();
  return useMutation({
    mutationFn: () => api<LocalResetResult>('/api/profiles/reset-local', { method: 'POST', headers: { 'x-ottlib-reset': '1' } }),
    onSuccess: (result) => {
      void client.invalidateQueries();
      const cleared = [result.ownerPinCleared && 'the owner PIN', result.accessPinCleared && 'the access PIN'].filter(Boolean).join(' and ');
      show(cleared ? `Cleared ${cleared}.` : 'No PINs were set.', 'success');
    }
  });
}
