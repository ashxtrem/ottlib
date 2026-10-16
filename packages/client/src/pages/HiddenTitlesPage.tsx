import { Link } from 'react-router-dom';
import { PosterImage } from '../components/PosterImage';
import { NoArtworkCard } from '../components/NoArtworkCard';
import { focusRing } from '../components/interactionStyles';
import { useHiddenTitles } from '../hooks/useHiddenTitles';
import { useToast } from '../hooks/useToast';

export function HiddenTitlesPage() {
  const { hidden, unhide, unhideAll } = useHiddenTitles();
  const { show } = useToast();
  return <section>
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-bold">Hidden titles</h1><p className="mt-1 text-sm text-muted">Hidden only on this device. Other devices still show these titles.</p></div>
      {hidden.length > 1 && <button type="button" onClick={() => { unhideAll(); show('All titles are visible again.', 'success'); }} className={`rounded-lg border border-border-strong px-3 py-2 text-sm font-medium hover:bg-surface-raised ${focusRing}`}>Unhide all</button>}
    </div>
    {hidden.length === 0 && <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted">Nothing is hidden. Use Hide on a title's page to keep it out of your library view.</div>}
    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4">{hidden.slice().reverse().map((entry) => <article key={entry.key} className="flex flex-col overflow-hidden rounded-xl bg-surface shadow-lg ring-1 ring-border">
      <Link to={`/movie/${entry.id}`} className={`block ${focusRing}`}><div className="aspect-[2/3] overflow-hidden bg-surface-raised">{entry.posterUrl ? <PosterImage src={entry.posterUrl} alt={`${entry.title} poster`} loading="lazy" decoding="async" className="h-full w-full object-cover opacity-70" /> : <NoArtworkCard title={entry.title} year={entry.year} status="matched" />}</div></Link>
      <div className="flex flex-1 flex-col gap-2 p-3"><p className="line-clamp-2 break-words text-sm font-medium">{entry.title}</p><p className="text-xs text-muted">{entry.isShow ? 'Whole show' : entry.year ?? 'Movie'}</p>
        <button type="button" onClick={() => { unhide(entry.key); show(`${entry.title} is visible again.`, 'success'); }} className={`mt-auto rounded-lg border border-border-strong px-2 py-1.5 text-xs font-semibold hover:bg-surface-raised ${focusRing}`}>Unhide</button></div>
    </article>)}</div>
  </section>;
}
