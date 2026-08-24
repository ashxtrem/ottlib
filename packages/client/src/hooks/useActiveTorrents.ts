import { useQuery } from '@tanstack/react-query';
import type { ActiveTorrentDownloads } from '@ottlib/shared';
import { api } from './apiClient';

export function useActiveTorrents() {
  return useQuery({
    queryKey: ['active-torrents'],
    queryFn: () => api<ActiveTorrentDownloads>('/api/torrents/active'),
    refetchInterval: 3_000,
    refetchIntervalInBackground: false
  });
}
