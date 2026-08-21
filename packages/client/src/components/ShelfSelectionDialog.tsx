import { useEffect, useMemo, useState } from 'react';
import type { Movie } from '@ottlib/shared';
import { useMovieFilterOptions, useMovies } from '../hooks/useMovies';
import { CloseIcon } from './icons';

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
  const [genre, setGenre] = useState('');
  const [actor, setActor] = useState('');
  const [minRating, setMinRating] = useState<number>();
  const [watched, setWatched] = useState<boolean>();
  const [sort, setSort] = useState('title');
  const [name, setName] = useState(initialName);
  const [selectedIds, setSelectedIds] = useState<number[]>(initialSelectedIds);
  const movies = useMovies({ search, genre, actor, minRating, watched, sort });
  const filterOptions = useMovieFilterOptions();
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedKey = initialSelectedIds.join(',');

  useEffect(() => {
    if (!open) return;
    setSearch(''); setGenre(''); setActor(''); setMinRating(undefined); setWatched(undefined); setSort('title'); setName(initialName); setSelectedIds(initialSelectedIds);
  }, [open, initialName, selectedKey]);

  if (!open) return null;
  const toggle = (movie: Movie) => setSelectedIds((current) => current.includes(movie.id) ? current.filter((id) => id !== movie.id) : [...current, movie.id]);
  const selectAllShown = () => setSelectedIds((current) => [...new Set([...current, ...(movies.data ?? []).map((movie) => movie.id)])]);
  const filtersActive = Boolean(search || genre || actor || minRating !== undefined || watched !== undefined || sort !== 'title');
  const clearFilters = () => { setSearch(''); setGenre(''); setActor(''); setMinRating(undefined); setWatched(undefined); setSort('title'); };
  const canSave = selectedIds.length > 0 && (!requireName || Boolean(name.trim()));
  return <div className="fixed inset-0 z-40 flex items-end bg-overlay/80 p-4 sm:items-center sm:justify-center" role="dialog" aria-modal="true" aria-label={title}>
    <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
      <div className="flex items-center justify-between border-b border-border px-5 py-4"><h2 className="text-lg font-semibold">{title}</h2><button type="button" onClick={onClose} className="rounded p-1 text-muted hover:text-foreground" aria-label="Close"><CloseIcon className="h-5 w-5" /></button></div>
      <div className="space-y-3 border-b border-border p-5">
        {requireName && <label className="block text-sm">Shelf name<input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="e.g. Marvel" className="mt-1 w-full rounded-lg border border-border bg-field px-3 py-2" /></label>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><label className="block text-sm">Search library<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title or IMDb ID" className="mt-1 w-full rounded-lg border border-border bg-field px-3 py-2" /></label><label className="block text-sm">Genre<select value={genre} onChange={(event) => setGenre(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-field px-3 py-2"><option value="">All genres</option>{filterOptions.data?.genres.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label className="block text-sm">Actor<input value={actor} onChange={(event) => setActor(event.target.value)} list="shelf-movie-actors" placeholder="Any actor" className="mt-1 w-full rounded-lg border border-border bg-field px-3 py-2" /></label><datalist id="shelf-movie-actors">{filterOptions.data?.actors.map((value) => <option key={value} value={value} />)}</datalist><label className="block text-sm">Minimum rating<select value={minRating ?? ''} onChange={(event) => setMinRating(event.target.value ? Number(event.target.value) : undefined)} className="mt-1 w-full rounded-lg border border-border bg-field px-3 py-2"><option value="">Any rating</option><option value="9">9.0+</option><option value="8">8.0+</option><option value="7">7.0+</option><option value="6">6.0+</option><option value="5">5.0+</option></select></label><label className="block text-sm">Watch status<select value={watched === undefined ? 'all' : String(watched)} onChange={(event) => setWatched(event.target.value === 'all' ? undefined : event.target.value === 'true')} className="mt-1 w-full rounded-lg border border-border bg-field px-3 py-2"><option value="all">All titles</option><option value="false">Unwatched</option><option value="true">Watched</option></select></label><label className="block text-sm">Sort<select value={sort} onChange={(event) => setSort(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-field px-3 py-2"><option value="title">Title</option><option value="year">Year</option><option value="added">Date added</option></select></label></div>
        <div className="flex flex-wrap items-center gap-3"><p className="text-sm text-muted">{selectedIds.length} title{selectedIds.length === 1 ? '' : 's'} selected</p><button type="button" onClick={selectAllShown} disabled={!movies.data?.length} className="text-sm text-accent hover:underline disabled:cursor-not-allowed disabled:opacity-50">Select all shown</button>{selectedIds.length > 0 && <button type="button" onClick={() => setSelectedIds([])} className="text-sm text-muted hover:text-foreground hover:underline">Clear selection</button>}</div>
        {filtersActive && <button type="button" onClick={clearFilters} className="text-sm text-muted hover:text-accent hover:underline">Clear filters</button>}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {movies.isLoading && <p className="text-muted">Loading titles…</p>}
        {movies.error && <p className="text-error">{movies.error.message}</p>}
        {movies.data?.length === 0 && <p className="text-muted">No titles match this search.</p>}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3">{movies.data?.map((movie) => <SelectableMovieCard key={movie.id} movie={movie} checked={selected.has(movie.id)} onToggle={() => toggle(movie)} />)}</div>
      </div>
      <div className="flex justify-end gap-3 border-t border-border p-4"><button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-foreground/90 hover:bg-surface-raised">Cancel</button><button type="button" onClick={() => onSave({ name: name.trim(), movieIds: selectedIds })} disabled={!canSave || saving} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60">{saving ? 'Saving…' : confirmLabel}</button></div>
    </div>
  </div>;
}

function SelectableMovieCard({ movie, checked, onToggle }: { movie: Movie; checked: boolean; onToggle: () => void }) {
  return <label className={`relative cursor-pointer overflow-hidden rounded-xl bg-field ring-1 transition ${checked ? 'ring-2 ring-accent' : 'ring-border hover:ring-border-strong'}`}>
    <input checked={checked} onChange={onToggle} type="checkbox" className="absolute left-2 top-2 z-10 h-5 w-5 accent-accent" aria-label={`Select ${movie.title}`} />
    <div className="aspect-[2/3] bg-surface-raised">{movie.posterUrl ? <img src={movie.posterUrl} alt={`${movie.title} poster`} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center p-3 text-center text-xs text-subtle">No poster<br />{movie.title}</div>}</div>
    <div className="p-2"><div className="truncate text-sm font-medium text-foreground">{movie.title}</div><div className="text-xs text-muted">{movie.year ?? '—'}</div></div>
  </label>;
}
