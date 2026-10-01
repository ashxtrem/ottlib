import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { AuthStatus, PinLoginResult, SetAccessPin } from '@ottlib/shared';
import { api, unauthorizedEvent } from './apiClient';
import { useToast } from './useToast';

const statusKey = ['auth-status'];

export function useAuthStatus() {
  const client = useQueryClient();
  useEffect(() => {
    const recheck = () => void client.invalidateQueries({ queryKey: statusKey });
    window.addEventListener(unauthorizedEvent, recheck);
    return () => window.removeEventListener(unauthorizedEvent, recheck);
  }, [client]);
  return useQuery({ queryKey: statusKey, queryFn: () => api<AuthStatus>('/api/auth/status'), staleTime: Infinity });
}

/** Signing in or out changes what every query may load, so each success refetches everything. */
export function useAccessPinActions() {
  const client = useQueryClient(); const { show } = useToast();
  const refetchAll = () => void client.invalidateQueries();
  const login = useMutation({ mutationFn: (pin: string) => api<PinLoginResult>('/api/auth/login', { method: 'POST', body: JSON.stringify({ pin }) }), onSuccess: refetchAll });
  const logout = useMutation({ mutationFn: () => api<void>('/api/auth/logout', { method: 'POST' }), onSuccess: refetchAll });
  const setPin = useMutation({ mutationFn: (input: SetAccessPin) => api<PinLoginResult>('/api/auth/pin', { method: 'PUT', body: JSON.stringify(input) }), onSuccess: () => { refetchAll(); show('Access PIN saved. Other devices need to sign in again.', 'success'); } });
  const removePin = useMutation({ mutationFn: (currentPin: string) => api<void>('/api/auth/pin/remove', { method: 'POST', body: JSON.stringify({ currentPin }) }), onSuccess: () => { refetchAll(); show('Access PIN removed.', 'success'); } });
  return { login, logout, setPin, removePin };
}
