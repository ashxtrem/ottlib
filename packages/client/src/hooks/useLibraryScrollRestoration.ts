import { useEffect, useLayoutEffect, useRef } from 'react';

const storageKey = 'ottlib-library-scroll-y';

export function saveLibraryScrollPosition(): void {
  sessionStorage.setItem(storageKey, String(window.scrollY));
}

export function useLibraryScrollRestoration(ready: boolean): void {
  const restored = useRef(false);
  useLayoutEffect(() => {
    if (!ready || restored.current) return;
    restored.current = true;
    const savedPosition = Number(sessionStorage.getItem(storageKey) ?? '0');
    if (!Number.isFinite(savedPosition) || savedPosition <= 0) return;

    const restore = () => window.scrollTo({ top: savedPosition, behavior: 'auto' });
    restore();
    const frame = requestAnimationFrame(restore);
    return () => cancelAnimationFrame(frame);
  }, [ready]);

  useEffect(() => {
    window.addEventListener('scroll', saveLibraryScrollPosition, { passive: true });
    return () => {
      saveLibraryScrollPosition();
      window.removeEventListener('scroll', saveLibraryScrollPosition);
    };
  }, []);
}
