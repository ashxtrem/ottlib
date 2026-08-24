import { useCountUp } from '../hooks/useCountUp';
import { useEffect, useState } from 'react';

interface LibraryOverviewProps {
  titleCount: number | undefined;
  unavailableCount: number | undefined;
  matchingTitleCount?: number | undefined;
  acceptedMatchCount: number | undefined;
  className?: string;
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

function CountLabel({ count, singular, plural }: { count: number; singular: string; plural?: string }) {
  const displayCount = useCountUp(count);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  if (!hydrated) return <>{pluralize(count, singular, plural)}</>;
  return <><span aria-hidden="true">{pluralize(displayCount, singular, plural)}</span><span className="sr-only">{pluralize(count, singular, plural)}</span></>;
}

export function LibraryOverview({ titleCount, unavailableCount, matchingTitleCount, acceptedMatchCount, className }: LibraryOverviewProps) {
  if (titleCount === undefined && unavailableCount === undefined && matchingTitleCount === undefined && acceptedMatchCount === undefined) return null;

  return <div aria-label="Library overview" className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-sm ${className ?? 'mb-5'}`}>
    {titleCount !== undefined && <p className="whitespace-nowrap font-medium tabular-nums text-foreground"><CountLabel count={titleCount} singular="title" /></p>}
    {unavailableCount !== undefined && <p className="whitespace-nowrap border-l border-border pl-3 tabular-nums text-warning"><CountLabel count={unavailableCount} singular="unavailable title" plural="unavailable titles" /></p>}
    {matchingTitleCount !== undefined && <p className="whitespace-nowrap border-l border-border pl-3 tabular-nums text-muted">Showing <CountLabel count={matchingTitleCount} singular="matching title" /></p>}
    {acceptedMatchCount !== undefined && <p className="whitespace-nowrap border-l border-border pl-3 tabular-nums text-success-foreground"><CountLabel count={acceptedMatchCount} singular="match" plural="matches" /> accepted</p>}
  </div>;
}
