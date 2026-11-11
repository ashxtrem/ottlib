import { findMode, type FindMode } from '@ottlib/shared';
import { useSettings } from './useSettings';

/** What Find does right now: `off` (entry points hidden), `qbittorrent` (in-app search) or `hashlark` (hand-off to the server PC). */
export function useFindMode(): FindMode {
  const settings = useSettings().data;
  return settings ? findMode(settings) : 'off';
}
