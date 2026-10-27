import { useCallback, useState } from 'react';
import type { AutoSkipOverrideResult, CreditsMarkResult, PlaybackSource } from '@ottlib/shared';
import { api } from './apiClient';
import { useToast } from './useToast';
import type { AutoSkipChoice, MoreCommand } from '../utils/moreMenuItems';

const overrideBody: Record<AutoSkipChoice, boolean | null> = { on: true, off: false, default: null };

/**
 * The More menu's commands: PUT the credits mark or this profile's auto-skip override, then patch the playback source
 * with the server's answer so the player uses the new values at once.
 */
export function useCreditsActions(movieId: number, patchSource: (changes: Partial<PlaybackSource>) => void) {
  const { show } = useToast();
  const [choice, setChoice] = useState<AutoSkipChoice | null>(null);

  const run = useCallback(async (command: MoreCommand, positionMs: number) => {
    try {
      if (command.kind === 'auto-skip') {
        const result = await api<AutoSkipOverrideResult>(`/api/movies/${movieId}/auto-skip`, { method: 'PUT', body: JSON.stringify({ enabled: overrideBody[command.choice] }) });
        setChoice(command.choice);
        patchSource({ autoSkipCredits: result.autoSkipCredits });
        return;
      }
      const startMs = command.kind === 'mark' ? Math.max(0, Math.round(positionMs)) : null;
      const result = await api<CreditsMarkResult>(`/api/movies/${movieId}/credits`, { method: 'PUT', body: JSON.stringify({ startMs }) });
      patchSource({ credits: result.credits });
    } catch (error) {
      show(error instanceof Error ? error.message : 'Could not save the change.', 'error');
    }
  }, [movieId, patchSource, show]);

  return { choice, run };
}
