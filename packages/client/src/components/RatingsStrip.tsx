import type { OutsideRating } from '@ottlib/shared';

const sourceLabels: Record<OutsideRating['source'], string> = { imdb: 'IMDb', rottenTomatoes: 'Rotten Tomatoes', metacritic: 'Metacritic' };
const sourceOrder: OutsideRating['source'][] = ['imdb', 'rottenTomatoes', 'metacritic'];

export function formatOutsideRating({ source, value, max }: OutsideRating): string {
  if (source === 'rottenTomatoes') return `${Math.round(value)}%`;
  if (source === 'metacritic') return `${Math.round(value)}/${max}`;
  return `${value.toFixed(1)}/${max}`;
}

/** IMDb, Rotten Tomatoes and Metacritic scores; the single provider ★ when no outside ratings are known. */
export function RatingsStrip({ ratings, fallback }: { ratings: OutsideRating[]; fallback: number | null }) {
  const sorted = [...ratings].sort((a, b) => sourceOrder.indexOf(a.source) - sourceOrder.indexOf(b.source));
  if (!sorted.length) return fallback ? <p className="text-sm text-muted" aria-label={`Rating ${fallback.toFixed(1)}`}>★ {fallback.toFixed(1)}</p> : null;
  return <ul aria-label="Ratings" className="flex flex-wrap gap-2">{sorted.map((rating) => <li key={rating.source} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-raised px-2.5 py-1 text-sm">
    <span className="text-xs font-semibold uppercase tracking-wide text-subtle">{sourceLabels[rating.source]}</span>
    <span className="font-semibold text-foreground">{formatOutsideRating(rating)}</span>
  </li>)}</ul>;
}
