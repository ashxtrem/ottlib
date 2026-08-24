import { useQuery } from '@tanstack/react-query';
import type { TorrentConnectionStatus } from '@ottlib/shared';
import { api } from './apiClient';

export function useQbittorrentStatus() {
  return useQuery({ queryKey: ['qbittorrent-connection'], queryFn: () => api<TorrentConnectionStatus>('/api/torrents/connection'), staleTime: 30_000 });
}
