interface SkeletonBlockProps {
  className?: string;
}

export function SkeletonBlock({ className = '' }: SkeletonBlockProps) {
  return <div aria-hidden="true" className={`shimmer rounded bg-surface-raised ${className}`} />;
}

export function SkeletonPosterGrid({ count = 12, compact = false }: { count?: number; compact?: boolean }) {
  const cardClassName = compact ? 'grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3' : 'grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4';
  return <div aria-busy="true" aria-live="polite" className={`grid ${cardClassName}`}>
    <span className="sr-only">Loading titles…</span>
    {Array.from({ length: count }, (_, index) => <div key={index} className="space-y-3"><SkeletonBlock className="aspect-[2/3] w-full" /><SkeletonBlock className="h-4 w-4/5" /><SkeletonBlock className="h-3 w-2/5" /></div>)}
  </div>;
}

export function SkeletonDetail() {
  return <section aria-busy="true" aria-live="polite" className="space-y-6"><span className="sr-only">Loading title…</span><SkeletonBlock className="h-5 w-32" /><div className="grid gap-6 rounded-2xl border border-border bg-surface p-5 md:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_260px]"><SkeletonBlock className="aspect-[2/3] w-full" /><div className="space-y-5"><SkeletonBlock className="h-9 w-3/4" /><SkeletonBlock className="h-4 w-2/5" /><SkeletonBlock className="h-11 w-full" /><SkeletonBlock className="h-4 w-full" /><SkeletonBlock className="h-4 w-11/12" /><SkeletonBlock className="h-4 w-4/5" /></div><SkeletonBlock className="hidden h-44 xl:block" /></div></section>;
}

export function SkeletonShelfGrid() {
  return <div aria-busy="true" aria-live="polite" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"><span className="sr-only">Loading shelves…</span>{Array.from({ length: 3 }, (_, index) => <div key={index} className="space-y-4 rounded-2xl border border-border bg-surface p-4"><SkeletonBlock className="aspect-video w-full" /><SkeletonBlock className="h-5 w-3/5" /><SkeletonBlock className="h-4 w-2/5" /></div>)}</div>;
}

export function SkeletonSettings() {
  return <section aria-busy="true" aria-live="polite" className="max-w-3xl space-y-8"><span className="sr-only">Loading settings…</span>{Array.from({ length: 4 }, (_, index) => <div key={index} className="space-y-4 rounded-xl border border-border bg-surface p-5"><SkeletonBlock className="h-6 w-1/3" /><SkeletonBlock className="h-10 w-full" /><SkeletonBlock className="h-10 w-full" /></div>)}</section>;
}
