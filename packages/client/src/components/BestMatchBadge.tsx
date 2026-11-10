export function BestMatchBadge({ score }: { score: number | null }) {
  return <span title={score === null ? undefined : `Match score ${Math.round(score)} of 100`} className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">Best match</span>;
}
