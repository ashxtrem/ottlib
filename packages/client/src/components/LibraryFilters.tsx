import { useState } from 'react';
import { formatMediaLanguage, type MovieFilterOptions } from '@ottlib/shared';
import { Modal } from './Modal';

export interface LibraryFilterValues {
  search: string;
  availability: 'available' | 'unavailable' | undefined;
  genre: string;
  actor: string;
  quality: string;
  audioLanguage: string;
  minRating: number | undefined;
  watched: boolean | undefined;
  sort: string;
  needsReview?: boolean;
}

interface LibraryFiltersProps {
  values: LibraryFilterValues;
  options: MovieFilterOptions | undefined;
  onSearchChange: (value: string) => void;
  onAvailabilityChange: (value: 'available' | 'unavailable' | undefined) => void;
  onGenreChange: (value: string) => void;
  onActorChange: (value: string) => void;
  onQualityChange: (value: string) => void;
  onAudioLanguageChange: (value: string) => void;
  onMinRatingChange: (value: number | undefined) => void;
  onWatchedChange: (value: boolean | undefined) => void;
  onSortChange: (value: string) => void;
  onNeedsReviewChange?: (value: boolean) => void;
  onClearFilters: () => void;
  onCommitFilters?: (replace: boolean) => void;
  idPrefix: string;
  searchLabel?: string;
  searchPlaceholder?: string;
  entityName?: string;
}

interface ActiveFilter {
  label: string;
  remove: () => void;
}

export function countActiveFilters(values: LibraryFilterValues): number {
  return Number(Boolean(values.search.trim())) + Number(values.availability !== undefined) + Number(Boolean(values.genre)) + Number(Boolean(values.actor)) + Number(Boolean(values.quality)) + Number(Boolean(values.audioLanguage)) + Number(values.minRating !== undefined) + Number(values.watched !== undefined) + Number(Boolean(values.needsReview));
}

function FilterFields({ values, options, onAvailabilityChange, onGenreChange, onActorChange, onQualityChange, onAudioLanguageChange, onMinRatingChange, onWatchedChange, onSortChange, onNeedsReviewChange, idPrefix, entityName }: Omit<LibraryFiltersProps, 'onSearchChange' | 'onClearFilters' | 'searchLabel' | 'searchPlaceholder'>) {
  const actorListId = `${idPrefix}-actors`;
  return <div className="grid gap-3 sm:grid-cols-2">
    <label className="block text-sm">Genre<select value={values.genre} onChange={(event) => onGenreChange(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-field px-3 py-2"><option value="">All genres</option>{options?.genres.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
    <label className="block text-sm">Actor<input value={values.actor} onChange={(event) => onActorChange(event.target.value)} list={actorListId} placeholder="Any actor" className="mt-1 w-full rounded-lg border border-border bg-field px-3 py-2" /></label>
    <datalist id={actorListId}>{options?.actors.map((value) => <option key={value} value={value} />)}</datalist>
    <label className="block text-sm">Quality<select value={values.quality} onChange={(event) => onQualityChange(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-field px-3 py-2"><option value="">Any quality</option>{options?.resolutions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
    <label className="block text-sm">Audio language<select value={values.audioLanguage} onChange={(event) => onAudioLanguageChange(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-field px-3 py-2"><option value="">Any audio language</option>{options?.audioLanguages.map((value) => <option key={value} value={value}>{formatMediaLanguage(value)}</option>)}</select></label>
    <label className="block text-sm">Minimum rating<select value={values.minRating ?? ''} onChange={(event) => onMinRatingChange(event.target.value ? Number(event.target.value) : undefined)} className="mt-1 w-full rounded-lg border border-border bg-field px-3 py-2"><option value="">Any rating</option><option value="9">9.0+</option><option value="8">8.0+</option><option value="7">7.0+</option><option value="6">6.0+</option><option value="5">5.0+</option></select></label>
    <label className="block text-sm">Watch status<select value={values.watched === undefined ? 'all' : String(values.watched)} onChange={(event) => onWatchedChange(event.target.value === 'all' ? undefined : event.target.value === 'true')} className="mt-1 w-full rounded-lg border border-border bg-field px-3 py-2"><option value="all">All {entityName}</option><option value="false">Unwatched</option><option value="true">Watched</option></select></label>
    <label className="block text-sm">Availability<select value={values.availability ?? ''} onChange={(event) => onAvailabilityChange(event.target.value === 'available' || event.target.value === 'unavailable' ? event.target.value : undefined)} className="mt-1 w-full rounded-lg border border-border bg-field px-3 py-2"><option value="">All availability</option><option value="available">Available</option><option value="unavailable">Unavailable</option></select></label>
    <label className="block text-sm">Sort<select value={values.sort} onChange={(event) => onSortChange(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-field px-3 py-2"><option value="title">Title</option><option value="year">Year</option><option value="added">Date added</option><option value="quality">Resolution</option></select></label>
    {onNeedsReviewChange && <label className="flex items-center gap-2 self-end rounded-lg border border-border px-3 py-2 text-sm"><input type="checkbox" checked={Boolean(values.needsReview)} onChange={(event) => onNeedsReviewChange(event.target.checked)} className="accent-accent" />Needs review</label>}
  </div>;
}

function ActiveFilterChips({ values, onSearchChange, onAvailabilityChange, onGenreChange, onActorChange, onQualityChange, onAudioLanguageChange, onMinRatingChange, onWatchedChange, onNeedsReviewChange }: Pick<LibraryFiltersProps, 'values' | 'onSearchChange' | 'onAvailabilityChange' | 'onGenreChange' | 'onActorChange' | 'onQualityChange' | 'onAudioLanguageChange' | 'onMinRatingChange' | 'onWatchedChange' | 'onNeedsReviewChange'>) {
  const filters: ActiveFilter[] = [
    values.search.trim() ? { label: `Search: ${values.search.trim()}`, remove: () => onSearchChange('') } : null,
    values.availability ? { label: `Availability: ${values.availability === 'available' ? 'Available' : 'Unavailable'}`, remove: () => onAvailabilityChange(undefined) } : null,
    values.genre ? { label: `Genre: ${values.genre}`, remove: () => onGenreChange('') } : null,
    values.actor ? { label: `Actor: ${values.actor}`, remove: () => onActorChange('') } : null,
    values.quality ? { label: `Quality: ${values.quality}`, remove: () => onQualityChange('') } : null,
    values.audioLanguage ? { label: `Audio: ${formatMediaLanguage(values.audioLanguage)}`, remove: () => onAudioLanguageChange('') } : null,
    values.minRating !== undefined ? { label: `Rating: ${values.minRating}.0+`, remove: () => onMinRatingChange(undefined) } : null,
    values.watched !== undefined ? { label: values.watched ? 'Watched' : 'Unwatched', remove: () => onWatchedChange(undefined) } : null,
    values.needsReview && onNeedsReviewChange ? { label: 'Needs review', remove: () => onNeedsReviewChange(false) } : null
  ].filter((filter): filter is ActiveFilter => filter !== null);
  if (!filters.length) return null;
  return <div className="mt-3 flex flex-wrap gap-2" aria-label="Active filters">{filters.map((filter) => <button key={filter.label} type="button" onClick={filter.remove} className="rounded-full border border-accent-soft-border bg-accent-soft px-3 py-1 text-xs text-accent-soft-foreground hover:bg-accent-soft/70">{filter.label}<span aria-hidden="true"> ×</span><span className="sr-only">Remove {filter.label} filter</span></button>)}</div>;
}

export function LibraryFilters(props: LibraryFiltersProps) {
  const [open, setOpen] = useState(false);
  const activeCount = countActiveFilters(props.values);
  const searchLabel = props.searchLabel ?? 'Search library';
  const searchPlaceholder = props.searchPlaceholder ?? 'Search title or IMDb ID';
  const entityName = props.entityName ?? 'titles';

  const filterFields = <FilterFields {...props} idPrefix={props.idPrefix} entityName={entityName} />;
  return <div>
    <div className="flex gap-2"><input value={props.values.search} onChange={(event) => props.onSearchChange(event.target.value)} placeholder={searchPlaceholder} aria-label={searchLabel} className="min-w-0 flex-1 rounded-lg border border-border bg-field px-4 py-2 outline-none ring-accent focus:ring" /><button type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-haspopup="dialog" className="shrink-0 rounded-lg border border-border-strong px-3 py-2 text-sm font-medium hover:bg-surface-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Filters{activeCount > 0 && <span className="ml-2 rounded-full bg-accent px-1.5 py-0.5 text-xs text-accent-foreground">{activeCount}</span>}</button></div>
    <ActiveFilterChips {...props} />
    <Modal open={open} title="Filters" onClose={() => setOpen(false)} maxWidthClassName="max-w-[32rem]" footer={<><button type="button" onClick={props.onClearFilters} disabled={!activeCount} className="mr-auto rounded-lg px-4 py-2 text-sm text-muted hover:bg-surface-raised hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50">Clear all</button><button type="button" onClick={() => { props.onCommitFilters?.(false); setOpen(false); }} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover">Done</button></>}><div className="min-h-0 flex-1 overflow-y-auto p-5">{filterFields}</div></Modal>
  </div>;
}
