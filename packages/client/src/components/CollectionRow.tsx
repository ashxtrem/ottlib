import { Link, useLocation } from 'react-router-dom';
import type { MovieCollection } from '@ottlib/shared';
import { NoArtworkCard } from './NoArtworkCard';
import { PosterImage } from './PosterImage';
import { focusRing, liftable } from './interactionStyles';
import { useCollection } from '../hooks/useCollection';
import { useTorrentSearchEnabled } from '../hooks/useTorrentSearchEnabled';

export function torrentSearchHref(title: string, year: number | null): string {
  return `/torrents?q=${encodeURIComponent(title)}${year ? `&year=${year}` : ''}`;
}

type CollectionRowViewProps = { collection: MovieCollection; currentId: number; torrentSearchEnabled: boolean; linkState?: unknown };

/** "Part of <name>": owned titles as cards, missing ones dimmed with their year and an optional torrent search link. */
export function CollectionRowView({ collection, currentId, torrentSearchEnabled, linkState }: CollectionRowViewProps) {
  if (!collection.owned.length && !collection.missing.length) return null;
  return <section aria-labelledby="collection-row-heading" className="rounded-xl border border-border bg-surface p-5">
    <h2 id="collection-row-heading" className="font-semibold">Part of {collection.name}</h2>
    <ul className="mt-4 flex gap-4 overflow-x-auto pb-2">
      {collection.owned.map((movie) => <li key={`owned-${movie.id}`} className="w-32 shrink-0 md:w-36">
        <Link to={`/movie/${movie.id}`} state={linkState} aria-current={movie.id === currentId ? 'page' : undefined} aria-label={`${movie.title}${movie.year ? ` (${movie.year})` : ''}`} className={`block overflow-hidden rounded-xl bg-surface-raised ring-1 ${movie.id === currentId ? 'ring-2 ring-accent' : 'ring-border hover:ring-accent'} ${liftable} ${focusRing}`}>
          <div className="aspect-[2/3] overflow-hidden">{movie.posterUrl ? <PosterImage src={movie.posterUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <NoArtworkCard title={movie.title} year={movie.year} status={movie.metadataStatus} />}</div>
        </Link>
        <p className="mt-2 line-clamp-2 break-words text-sm font-medium">{movie.title}{movie.year ? <span className="text-muted"> ({movie.year})</span> : null}</p>
      </li>)}
      {collection.missing.map((part) => <li key={`missing-${part.tmdbId}`} data-missing-part className="w-32 shrink-0 md:w-36">
        <div className="aspect-[2/3] overflow-hidden rounded-xl bg-surface-raised opacity-40 ring-1 ring-border grayscale">
          {part.posterUrl ? <PosterImage src={part.posterUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <NoArtworkCard title={part.title} year={part.year} status="matched" />}
        </div>
        <p className="mt-2 line-clamp-2 break-words text-sm font-medium text-muted">{part.title}</p>
        <p className="text-xs text-subtle">{part.year ?? '—'} · Not in library</p>
        {torrentSearchEnabled && <Link to={torrentSearchHref(part.title, part.year)} aria-label={`Find ${part.title}`} className={`mt-1 inline-flex rounded-md text-xs font-medium text-accent hover:underline ${focusRing}`}>Find</Link>}
      </li>)}
    </ul>
  </section>;
}

/** The title page's collection row; hidden when the title is not part of a collection. */
export function CollectionRow({ movieId }: { movieId: string }) {
  const collection = useCollection(movieId);
  const torrentSearchEnabled = useTorrentSearchEnabled();
  const { state } = useLocation();
  if (!collection.data) return null;
  return <CollectionRowView collection={collection.data} currentId={Number(movieId)} torrentSearchEnabled={torrentSearchEnabled} linkState={state} />;
}
