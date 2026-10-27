import { focusRing } from '../interactionStyles';

interface SkipCreditsButtonProps {
  /** "Skip credits" completes the title; "Watch credits" stops the countdown up next runs from the credits. */
  kind: 'skip' | 'watch';
  /** Up next's card (preview or countdown) is on screen: the button sits above it. */
  aboveUpNext: boolean;
  onPress: () => void;
}

const RAISED = 'bottom-[16.5rem] md:bottom-[17rem]';
const LOW = 'bottom-28 md:bottom-32';

/**
 * Where the button sits: above up next's card while the card shows ("Watch credits" always shows next to its
 * countdown), otherwise in the card's place.
 */
export function skipCreditsPlace(kind: 'skip' | 'watch', aboveUpNext: boolean): string {
  return isSkipCreditsRaised(kind, aboveUpNext) ? RAISED : LOW;
}

export function isSkipCreditsRaised(kind: 'skip' | 'watch', aboveUpNext: boolean): boolean {
  return kind === 'watch' || aboveUpNext;
}

/** Bottom-right, above the controls, and clear of up next's card. */
export function SkipCreditsButton({ kind, aboveUpNext, onPress }: SkipCreditsButtonProps) {
  return <button
    type="button"
    onClick={onPress}
    className={`absolute right-3 z-20 min-h-11 animate-pop-in rounded-lg border border-white/20 bg-neutral-900/90 px-4 text-sm font-semibold text-white shadow-2xl hover:bg-neutral-800 md:right-6 md:min-h-10 ${skipCreditsPlace(kind, aboveUpNext)} ${focusRing}`}
  >
    {kind === 'skip' ? 'Skip credits' : 'Watch credits'}
  </button>;
}
