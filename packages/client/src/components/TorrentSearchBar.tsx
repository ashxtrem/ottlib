interface TorrentSearchBarProps {
  query: string;
  year: string;
  searching: boolean;
  onQueryChange: (value: string) => void;
  onYearChange: (value: string) => void;
  onSearch: () => void;
}

export function TorrentSearchBar({ query, year, searching, onQueryChange, onYearChange, onSearch }: TorrentSearchBarProps) {
  return <form onSubmit={(event) => { event.preventDefault(); onSearch(); }} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row">
    <label className="sr-only" htmlFor="torrent-search-query">Movie title</label>
    <input id="torrent-search-query" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search movie releases" className="min-w-0 flex-1 rounded-lg border border-border bg-field px-3 py-2" autoComplete="off" />
    <label className="sr-only" htmlFor="torrent-search-year">Year</label>
    <input id="torrent-search-year" value={year} onChange={(event) => onYearChange(event.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="Year" className="w-full rounded-lg border border-border bg-field px-3 py-2 sm:w-24" />
    <button disabled={!query.trim() || searching} className="rounded-lg bg-accent px-5 py-2 font-medium text-accent-foreground hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60">{searching ? 'Searching…' : 'Search'}</button>
  </form>;
}
