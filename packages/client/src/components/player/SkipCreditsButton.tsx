import { focusRing } from '../interactionStyles';

interface SkipCreditsButtonProps {
  /** "Skip credits" completes the title; "Watch credits" stops the countdown up next runs from the credits. */
  kind: 'skip' | 'watch';
  onPress: () => void;
}

/**
 * Bottom-right, above the controls. "Watch credits" shows next to up next's countdown card, so it sits above the card;
 * "Skip credits" shows without the card and takes the card's place.
 */
export function SkipCreditsButton({ kind, onPress }: SkipCreditsButtonProps) {
  const place = kind === 'watch' ? 'bottom-[16.5rem] md:bottom-[17rem]' : 'bottom-28 md:bottom-32';
  return <button
    type="button"
    onClick={onPress}
    className={`absolute right-3 z-20 min-h-11 animate-pop-in rounded-lg border border-white/20 bg-neutral-900/90 px-4 text-sm font-semibold text-white shadow-2xl hover:bg-neutral-800 md:right-6 md:min-h-10 ${place} ${focusRing}`}
  >
    {kind === 'skip' ? 'Skip credits' : 'Watch credits'}
  </button>;
}
