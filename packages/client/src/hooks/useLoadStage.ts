import { useEffect, useState } from 'react';

export type LoadStage = 'quiet' | 'skeleton' | 'reassure';

export const SKELETON_DELAY_MS = 150;
export const REASSURE_DELAY_MS = 10_000;

export function loadStageForElapsed(elapsedMs: number): LoadStage {
  if (elapsedMs >= REASSURE_DELAY_MS) return 'reassure';
  if (elapsedMs >= SKELETON_DELAY_MS) return 'skeleton';
  return 'quiet';
}

/** Stage of an active load: nothing for 150 ms, then the skeleton, then a reassurance line after 10 s. Resets when loading stops. */
export function useLoadStage(active: boolean): LoadStage {
  const [stage, setStage] = useState<LoadStage>('quiet');

  useEffect(() => {
    setStage('quiet');
    if (!active) return undefined;
    const skeletonTimer = setTimeout(() => setStage('skeleton'), SKELETON_DELAY_MS);
    const reassureTimer = setTimeout(() => setStage('reassure'), REASSURE_DELAY_MS);
    return () => {
      clearTimeout(skeletonTimer);
      clearTimeout(reassureTimer);
    };
  }, [active]);

  return active ? stage : 'quiet';
}
