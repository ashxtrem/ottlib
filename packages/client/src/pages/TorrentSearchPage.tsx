import { Link, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { TorrentResultTable } from '../components/TorrentResultTable';
import { TorrentSearchBar } from '../components/TorrentSearchBar';
import { ActiveTorrentDownloads } from '../components/ActiveTorrentDownloads';
import { useActiveTorrents } from '../hooks/useActiveTorrents';
import { useQbittorrentStatus } from '../hooks/useQbittorrentStatus';
import { useTorrentSearch } from '../hooks/useTorrentSearch';

export function TorrentSearchPage() {
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [year, setYear] = useState(params.get('year') ?? '');
  const search = useTorrentSearch();
  const connection = useQbittorrentStatus();
  const downloads = useActiveTorrents();
  useEffect(() => { setQuery(params.get('q') ?? ''); setYear(params.get('year') ?? ''); }, [params]);
  const submit = () => {
    const parsedYear = Number(year);
    search.start.mutate({ q: query.trim(), year: Number.isInteger(parsedYear) && parsedYear >= 1880 ? parsedYear : undefined });
  };
  const unavailable = connection.data?.status === 'not-configured' || connection.data?.status === 'plugins-missing';
  const state = search.state.data;
  return <section className="space-y-6">
    <div><h1 className="text-2xl font-bold">Torrent search</h1><p className="mt-1 text-sm text-muted">Search qBittorrent’s enabled movie plugins, then hand a chosen release back to qBittorrent.</p></div>
    <ActiveTorrentDownloads downloads={downloads.data} loading={downloads.isFetching} />
    {unavailable && <section className="rounded-xl border border-warning-border bg-warning-soft p-5"><h2 className="font-semibold text-warning">{connection.data?.status === 'not-configured' ? 'Set up qBittorrent first' : 'qBittorrent Search needs plugins'}</h2><p className="mt-2 text-sm text-muted">{connection.data?.message}</p><Link to="/settings" className="mt-3 inline-flex rounded-lg border border-warning-border px-4 py-2 text-sm font-medium text-warning hover:bg-warning-border/15">Open Settings</Link></section>}
    <TorrentSearchBar query={query} year={year} searching={search.start.isPending || state?.status === 'running'} onQueryChange={setQuery} onYearChange={setYear} onSearch={submit} />
    {search.start.error && <p className="rounded-lg border border-error/30 bg-error-soft p-3 text-sm text-error">{search.start.error.message}</p>}
    {search.start.data?.status === 'not-configured' && <p className="rounded-lg border border-warning-border bg-warning-soft p-3 text-sm text-warning">qBittorrent is not configured. <Link to="/settings" className="underline">Open Settings</Link></p>}
    {search.start.data?.status === 'unreachable' && <p className="rounded-lg border border-error/30 bg-error-soft p-3 text-sm text-error">{search.start.data.error ?? 'qBittorrent could not be reached.'}</p>}
    {search.state.error && <p className="rounded-lg border border-error/30 bg-error-soft p-3 text-sm text-error">{search.state.error.message}</p>}
    {state?.status === 'running' && <p className="text-sm text-muted">Searching qBittorrent… {state.total ? `${state.total} result${state.total === 1 ? '' : 's'} found so far.` : ''}</p>}
    {state?.status === 'unreachable' && <p className="rounded-lg border border-error/30 bg-error-soft p-3 text-sm text-error">{state.error}</p>}
    {state?.status === 'stopped' && (state.results.length ? <TorrentResultTable results={state.results} /> : <section className="rounded-xl border border-dashed border-border p-10 text-center"><h2 className="font-semibold">No releases found</h2><p className="mt-2 text-sm text-muted">Try a different title, or check qBittorrent’s Search plugins and movie categories.</p></section>)}
  </section>;
}
