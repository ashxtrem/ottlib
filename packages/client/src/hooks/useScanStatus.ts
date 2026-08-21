import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ScanRun } from '@ottlib/shared';
import { api } from './apiClient';

type ScanStatus = ScanRun | { status: 'idle' };
export function useScanStatus() { return useQuery({ queryKey: ['scan'], queryFn: () => api<ScanStatus>('/api/scan/status'), refetchInterval: (query) => query.state.data?.status === 'running' ? 1200 : false }); }
export function useStartScan() { const client = useQueryClient(); return useMutation({ mutationFn: () => api<ScanRun>('/api/scan', { method: 'POST' }), onSuccess: () => client.invalidateQueries({ queryKey: ['scan'] }) }); }
export function useScanHistory() { return useQuery({ queryKey: ['scan-history'], queryFn: () => api<ScanRun[]>('/api/scan/history') }); }
