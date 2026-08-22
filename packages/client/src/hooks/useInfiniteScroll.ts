import { useEffect, type RefObject } from 'react';

interface InfiniteScrollOptions {
  enabled: boolean;
  loading: boolean;
  onLoadMore: () => void;
}

export function useInfiniteScroll(target: RefObject<Element | null>, { enabled, loading, onLoadMore }: InfiniteScrollOptions): void {
  useEffect(() => {
    const element = target.current;
    if (!element || !enabled || loading) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) onLoadMore();
    }, { rootMargin: '600px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled, loading, onLoadMore, target]);
}
