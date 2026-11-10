import { useEffect, useRef, useState } from 'react';

/** Rows rendered straight away; the rest wait until they come near. */
export const eagerRowCount = 3;
/** How far below (or above) the screen a row starts rendering: 1.5 screens. */
export const lazyRowMargin = '150% 0px';

export function isEagerRow(index: number): boolean {
  return index < eagerRowCount;
}

/** Whether a home row should render yet. Put `ref` on its placeholder; once near, it stays rendered. */
export function useLazyRow(index: number) {
  const [near, setNear] = useState(() => isEagerRow(index));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (near || !ref.current) return;
    if (typeof IntersectionObserver === 'undefined') { setNear(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) setNear(true);
    }, { rootMargin: lazyRowMargin });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [near]);

  return { ref, near };
}
