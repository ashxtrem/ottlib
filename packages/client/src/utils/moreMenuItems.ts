import type { Credits } from '@ottlib/shared';
import { formatClock } from './playerTime';
import type { TrackMenuItem } from './trackMenuItems';

/** This title's auto-skip override (an episode's covers its series); `default` follows the profile's default. */
export type AutoSkipChoice = 'on' | 'off' | 'default';

export type MoreCommand =
  | { kind: 'mark' }
  | { kind: 'clear-mark' }
  | { kind: 'auto-skip'; choice: AutoSkipChoice };

export interface MoreMenuInput {
  positionMs: number;
  credits: Credits | null;
  /** Whether credits are skipped now (override or default). */
  autoSkip: boolean;
  /** The override picked in this player; null while unknown (the server only tells the resolved value). */
  choice: AutoSkipChoice | null;
}

const choiceLabels: Record<AutoSkipChoice, string> = { on: 'On', off: 'Off', default: 'Profile default' };

/** The player's More menu: mark the credits start, clear the mark, and this movie's (or series') auto-skip override. */
export function moreMenuItems({ positionMs, credits, autoSkip, choice }: MoreMenuInput): Array<TrackMenuItem & { command: MoreCommand }> {
  const marked = credits?.source === 'mark';
  const autoSkipItems = (['on', 'off', 'default'] as const).map((value) => ({
    key: `auto-skip-${value}`,
    label: `Auto-skip credits: ${choiceLabels[value]}`,
    // Unknown override: point at the value in force instead of guessing which choice gave it.
    detail: choice === null && value === (autoSkip ? 'on' : 'off') ? 'current' : undefined,
    selected: choice === value,
    command: { kind: 'auto-skip' as const, choice: value }
  }));
  return [
    { key: 'mark', label: 'Credits start here', detail: formatClock(positionMs), selected: false, action: true, command: { kind: 'mark' } },
    { key: 'clear-mark', label: 'Clear credits mark', detail: marked ? formatClock(credits.startMs) : undefined, selected: false, disabled: !marked, action: true, command: { kind: 'clear-mark' } },
    ...autoSkipItems
  ];
}
