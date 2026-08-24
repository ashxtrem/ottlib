import { useEffect, useMemo, useRef, useState } from 'react';
import type { MovieListItem } from '@ottlib/shared';
import { useMovieFilterOptions, useMovies } from '../hooks/useMovies';
import { NoArtworkCard } from './NoArtworkCard';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { LibraryFilters } from './LibraryFilters';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { Modal } from './Modal';
import { SkeletonPosterGrid } from './Skeleton';
import { PosterImage } from './PosterImage';

interface ShelfSelectionDialogProps {
  open: boolean;
  title: string;
  confirmLabel: string;
  requireName?: boolean;
  initialName?: string;
  initialSelectedIds?: number[];
  saving?: boolean;
  onClose: () => void;
  onSave: (value: { name: string; movieIds: number[] }) => void;
}

export function ShelfSelectionDialog({ open, title, confirmLabel, requireName = false, initialName = '', initialSelectedIds = [], saving, onClose, onSave }: ShelfSelectionDialogProps) {
  const [search, setSearch] = useState('');
  const [availability, setAvailability] = useState<'available' | 'unavailable'>();
  const [genre, setGenre] = useState('');
  const [actor, setActor] = useState('');
  const [quality, setQuality] = useState('');
  const [audioLanguage, setAudioLanguage] = useState('');
  const [minRating, setMinRating] = useState<number>();
  const [watched, setWatched] = useState<boolean>();
  const [sort, setSort] = useState('title');
  const [name, setName] = useState(initialName);
  const [selectedIds, setSelectedIds] = useState<number[]>(initialSelectedIds);
  const debouncedSearch = useDebouncedValue(search);
  const querySearch = debouncedSearch;
  const movies = useMovies({ search: querySearch, availability, genre, actor, quality, audioLanguage, minRating, watched, sort });
  const filterOptions = useMovieFilterOptions();
  const loadMore = useRef<HTMLDivElement>(null);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedKey = initialSelectedIds.join(',');

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setAvailability(undefined);
    setGenre('');
    setActor('');
    setQuality('');
    setAudioLanguage('');
    setMinRating(undefined);
    setWatched(undefined);
    setSort('title');
    setName(initialName);
    setSelectedIds(initialSelectedIds);
  }, [open, initialName, selectedKey]);

  useInfiniteScroll(loadMore, { enabled: open && Boolean(movies.hasNextPage), loading: movies.isFetchingNextPage, onLoadMore: () => { void movies.fetchNextPage(); } });
  const toggle = (movie: MovieListItem) => setSelectedIds((current) => current.includes(movie.id) ? current.filter((id) => id !== movie.id) : [...current, movie.id]);
  const selectAllShown = () => setSelectedIds((current) => [...new Set([...current, ...(movies.data?.items ?? []).map((movie) => movie.id)])]);
  const clearFilters = () => { setSearch(''); setAvailability(undefined); setGenre(''); setActor(''); setQuality(''); setAudioLanguage(''); setMinRating(undefined); setWatched(undefined); setSort('title'); };
  const requestClose = () => {
    if (selectedIds.length > 0 && !window.confirm('Discard the selected titles?')) return;
    onClose();
  };
  const filterValues = { search, availability, genre, actor, quality, audioLanguage, minRating, watched, sort };
  const canSave = requireName ? Boolean(name.trim()) : selectedIds.length > 0;

  return <Modal open={open} title={title} onClose={requestClose} maxWidthClassName="max-w-5xl" footer={<><button type="button" onClick={requestClose} className="rounded-lg px-4 py-2 text-sm text-foreground/90 hover:bg-surface-raised">Cancel</button><button type="button" onClick={() => onSave({ name: name.trim(), movieIds: selectedIds })} disabled={!canSave || saving} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover disabled:opacity-60">{saving ? 'Saving…' : confirmLabel}</button></>}>
    <div className="space-y-3 border-b border-border p-5">
      {requireName && <label className="block text-sm">Shelf name<input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="e.g. Marvel" className="mt-1 w-full rounded-lg border border-border bg-field px-3 py-2" /></label>}
      <LibraryFilters values={filterValues} options={filterOptions.data} onSearchChange={setSearch} onAvailabilityChange={setAvailability} onGenreChange={setGenre} onActorChange={setActor} onQualityChange={setQuality} onAudioLanguageChange={setAudioLanguage} onMinRatingChange={setMinRating} onWatchedChange={setWatched} onSortChange={setSort} onClearFilters={clearFilters} idPrefix="shelf-selection" />
      <div className="flex flex-wrap items-center gap-3"><p className="text-sm text-muted">{selectedIds.length} title{selectedIds.length === 1 ? '' : 's'} selected</p><button type="button" onClick={selectAllShown} disabled={!movies.data?.items.length} className="text-sm text-accent hover:underline disabled:cursor-not-allowed disabled:opacity-50">Select all shown</button>{selectedIds.length > 0 && <button type="button" onClick={() => setSelectedIds([])} className="text-sm text-muted hover:text-foreground hover:underline">Clear selection</button>}</div>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto p-5">
      {movies.isLoading && <SkeletonPosterGrid count={8} compact />}
      {movies.error && <p className="text-error">{movies.error.message}</p>}
      {movies.isSuccess && movies.data?.items.length === 0 && <p className="text-muted">No titles match this search.</p>}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3">{movies.data?.items.map((movie) => <SelectableMovieCard key={movie.id} movie={movie} checked={selected.has(movie.id)} onToggle={() => toggle(movie)} />)}</div>
      {movies.hasNextPage && <div ref={loadMore} className="py-6 text-center text-sm text-muted">{movies.isFetchingNextPage ? <SkeletonPosterGrid count={4} compact /> : 'Scroll for more titles'}</div>}
    </div>
  </Modal>;
}

function SelectableMovieCard({ movie, checked, onToggle }: { movie: MovieListItem; checked: boolean; onToggle: () => void }) {
  return <label className={`relative cursor-pointer overflow-hidden rounded-xl bg-field ring-1 transition-[box-shadow,transform] duration-fast ease-standard ${checked ? 'ring-2 ring-accent' : 'ring-border hover:ring-border-strong'}`}>
    <input checked={checked} onChange={onToggle} type="checkbox" className="absolute left-2 top-2 z-10 h-5 w-5 accent-accent" aria-label={`Select ${movie.title}`} />
    <div className="aspect-[2/3] bg-surface-raised">{movie.posterUrl ? <PosterImage src={movie.posterUrl} alt={`${movie.title} poster`} loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <NoArtworkCard title={movie.title} year={movie.year} status={movie.metadataStatus} />}</div>
    <div className="p-2"><div className="truncate text-sm font-medium text-foreground">{movie.title}</div><div className="text-xs text-muted">{movie.year ?? '—'}</div></div>
  </label>;
}
