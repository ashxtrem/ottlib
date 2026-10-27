import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Credits } from '@ottlib/shared';
import { useUpNext, watchPath } from './useUpNext';

interface CreditsRule {
  credits: Credits | null;
  autoSkip: boolean;
  /** "Watch credits" was pressed: the early countdown is off for this play. */
  watching: boolean;
}

/** Where the up-next countdown starts early: the credits start, with auto-skip on and not watching them; else null. */
export function creditsStartAt({ credits, autoSkip, watching }: CreditsRule): number | null {
  return credits && autoSkip && !watching ? credits.startMs : null;
}

export interface CreditsButtonsInput extends CreditsRule {
  hasNext: boolean;
  positionMs: number;
  ended: boolean;
  /** Up next's own Cancel: nothing more is offered. */
  upNextCancelled: boolean;
}

/**
 * Which credits button shows. With auto-skip on and a next title, the countdown runs from the credits start and
 * "Watch credits" cancels it. Otherwise (auto-skip off, or nothing next) "Skip credits" shows until the end.
 */
export function creditsButtons(input: CreditsButtonsInput): { skip: boolean; watch: boolean } {
  const { credits, hasNext, positionMs, ended, watching, upNextCancelled } = input;
  const inCredits = credits !== null && !ended && positionMs >= credits.startMs;
  if (!inCredits || watching || upNextCancelled) return { skip: false, watch: false };
  const early = creditsStartAt(input) !== null && hasNext;
  return { skip: !early, watch: early };
}

interface CreditsOptions {
  movieId: number;
  shelfId?: number;
  credits: Credits | null;
  autoSkip: boolean;
  positionMs: number;
  durationMs: number;
  ended: boolean;
  /** Posts complete (and stops the later progress PUTs). */
  complete: () => Promise<void>;
}

/**
 * Credits on the web player: watches the position against `credits.startMs`, starts up next's countdown there when
 * auto-skip is on, and otherwise offers "Skip credits", which completes the title and plays the next one or goes back
 * to the title page. Without credits, up next keeps its 20 s lead.
 */
export function useCredits({ movieId, shelfId, credits, autoSkip, positionMs, durationMs, ended, complete }: CreditsOptions) {
  const navigate = useNavigate();
  const [watching, setWatching] = useState(false);
  const rule = { credits, autoSkip, watching };
  const upNext = useUpNext({ movieId, shelfId, positionMs, durationMs, ended, startAtMs: creditsStartAt(rule), beforeEarlyNext: complete });
  const buttons = creditsButtons({ ...rule, hasNext: upNext.next !== null, positionMs, ended, upNextCancelled: upNext.cancelled });

  const skipping = useRef(false);
  const next = upNext.next;
  const skipCredits = useCallback(() => {
    if (skipping.current) return;
    skipping.current = true;
    void complete().finally(() => {
      if (next) navigate(watchPath(next.id, shelfId), { replace: true });
      else navigate(`/movie/${movieId}`, { replace: true });
    });
  }, [complete, next, shelfId, movieId, navigate]);
  const watchCredits = useCallback(() => setWatching(true), []);

  return { upNext, showSkip: buttons.skip, showWatch: buttons.watch, skipCredits, watchCredits };
}
