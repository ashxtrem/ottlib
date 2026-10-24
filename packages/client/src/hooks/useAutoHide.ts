import { useCallback, useEffect, useRef, useState } from 'react';

/** Controls hide after this long without pointer movement while playing. */
export const CONTROLS_HIDE_MS = 3_000;

/** Visible while `pinned` (paused, a menu open); otherwise hides 3 s after the last `show()`. `toggle()` is for taps. */
export function useAutoHide(pinned: boolean) {
  const [visible, setVisible] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const arm = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(false), CONTROLS_HIDE_MS);
  }, []);

  useEffect(() => {
    if (pinned) { clearTimeout(timer.current); setVisible(true); } else arm();
    return () => clearTimeout(timer.current);
  }, [pinned, arm]);

  const show = useCallback(() => { setVisible(true); if (!pinned) arm(); }, [pinned, arm]);
  const toggle = useCallback(() => {
    if (pinned) return;
    if (visible) { clearTimeout(timer.current); setVisible(false); } else { setVisible(true); arm(); }
  }, [pinned, visible, arm]);

  return { visible: visible || pinned, show, toggle };
}
