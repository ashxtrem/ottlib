import { useSettings } from './useSettings';

/** Torrent search is opt-in; its entry points stay hidden until it is switched on in Settings. */
export function useTorrentSearchEnabled(): boolean {
  return useSettings().data?.torrentSearchEnabled === true;
}
