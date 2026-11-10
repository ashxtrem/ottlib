import { useQuery } from '@tanstack/react-query';
import type { UpgradeCandidate } from '@ottlib/shared';
import { api } from './apiClient';

/** Library titles worth replacing; the server answers 404 while torrent search is off, so only ask when it is on. */
export function useUpgradeCandidates(enabled: boolean) {
  return useQuery({ queryKey: ['torrent-upgrade-candidates'], queryFn: () => api<UpgradeCandidate[]>('/api/torrents/upgrade-candidates'), enabled });
}
