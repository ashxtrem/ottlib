import { useEffect, useRef, useState } from 'react';

export function useSuccessPulse(succeeded: boolean, duration = 1_600): boolean {
  const [active, setActive] = useState(false);
  const previous = useRef(false);

  useEffect(() => {
    if (!succeeded || previous.current) {
      previous.current = succeeded;
      return;
    }
    previous.current = true;
    setActive(true);
    const timer = window.setTimeout(() => setActive(false), duration);
    return () => window.clearTimeout(timer);
  }, [duration, succeeded]);

  return active;
}
