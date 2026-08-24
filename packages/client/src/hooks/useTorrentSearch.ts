import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import type { TorrentSearchState, TorrentSearchStatus } from '@ottlib/shared';
import { api } from './apiClient';

interface StartResponse { searchId?: string; status: TorrentSearchStatus; error?: string }

export function useTorrentSearch() {
  const [searchId, setSearchId] = useState<string>();
  const searchIdRef = useRef<string | undefined>(undefined);
  useEffect(() => { searchIdRef.current = searchId; }, [searchId]);
  useEffect(() => () => { if (searchIdRef.current) void api<void>(`/api/torrents/search/${encodeURIComponent(searchIdRef.current)}`, { method: 'DELETE' }); }, []);

  const start = useMutation({
    mutationFn: async ({ q, year }: { q: string; year?: number }) => {
      if (searchIdRef.current) await api<void>(`/api/torrents/search/${encodeURIComponent(searchIdRef.current)}`, { method: 'DELETE' });
      setSearchId(undefined);
      const response = await api<StartResponse>('/api/torrents/search', { method: 'POST', body: JSON.stringify({ q, year }) });
      setSearchId(response.searchId);
      return response;
    }
  });
  const state = useQuery({
    queryKey: ['torrent-search', searchId],
    enabled: Boolean(searchId),
    queryFn: () => api<TorrentSearchState>(`/api/torrents/search/${encodeURIComponent(searchId!)}`),
    refetchInterval: (query) => query.state.data?.status === 'running' ? 750 : false
  });
  const cancel = async () => {
    if (!searchIdRef.current) return;
    const id = searchIdRef.current; setSearchId(undefined);
    await api<void>(`/api/torrents/search/${encodeURIComponent(id)}`, { method: 'DELETE' });
  };
  return { start, state, searchId, cancel };
}
