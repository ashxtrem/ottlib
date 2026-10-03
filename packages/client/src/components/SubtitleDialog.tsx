import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Movie } from '@ottlib/shared';
import { subtitleLanguageSchema } from '@ottlib/shared/subtitles';
import { useSubtitles } from '../hooks/useSubtitles';
import { Modal } from './Modal';

const inputClass = 'mt-1 w-full rounded-lg border border-border bg-field px-3 py-2';
const buttonClass = 'rounded-lg border border-border-strong px-3 py-2 hover:bg-surface-raised disabled:opacity-50';
export function SubtitleDialog({ movie, onClose }: { movie: Movie; onClose: () => void }) {
  const subtitles = useSubtitles(movie.id);
  const [mode, setMode] = useState<'auto' | 'filename' | 'manual'>('auto');
  const [query, setQuery] = useState(movie.title.replace(/\s*·\s*S\d+E\d+\s*$/i, ''));
  const [year, setYear] = useState(movie.year?.toString() ?? '');
  const [season, setSeason] = useState(movie.season?.toString() ?? '');
  const [episode, setEpisode] = useState(movie.episode?.toString() ?? '');
  const didSearch = useRef(false);
  const languages = subtitles.languages.split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
  const validLanguages = languages.length > 0 && languages.length <= 10 && languages.every(language => subtitleLanguageSchema.safeParse(language).success);
  const configured = subtitles.options.data?.providers.some(provider => provider.configured);
  const runSearch = () => subtitles.search.mutate({ mode, query, languages, year: year ? Number(year) : null, season: season ? Number(season) : null, episode: episode ? Number(episode) : null });
  useEffect(() => {
    if (didSearch.current || !configured || !validLanguages) return;
    didSearch.current = true; runSearch();
  }, [configured, validLanguages]);
  const languageName = (code: string) => subtitles.options.data?.languages.find(language => language.code === code)?.name ?? code.toUpperCase();
  return <Modal open title="Find subtitles" subtitle={movie.title} onClose={onClose} maxWidthClassName="max-w-3xl">
    <div className="space-y-4 p-5">
      {subtitles.options.isLoading && <p>Loading subtitle services…</p>}
      {subtitles.options.error && <p role="alert" className="text-error">{subtitles.options.error.message}</p>}
      {subtitles.options.data && !configured && <p className="text-warning">Add an OpenSubtitles or SubDL API key in <Link to="/settings" className="underline">Settings</Link> to search and download.</p>}
      <form onSubmit={event => { event.preventDefault(); runSearch(); }} className="space-y-3">
        <label className="block text-sm">Search using<select className={inputClass} value={mode} onChange={event => setMode(event.target.value as typeof mode)}>
          <option value="auto">Automatic match</option><option value="filename">Original filename</option><option value="manual">Enter a title</option>
        </select></label>
        {mode === 'filename' && <p className="break-all text-sm text-muted">{movie.rawFilename}</p>}
        {mode === 'manual' && <label className="block text-sm">Title<input required maxLength={250} className={inputClass} value={query} onChange={event => setQuery(event.target.value)} /></label>}
        <div className="grid grid-cols-3 gap-3">
          <label className="text-sm">Year<input type="number" min={1800} max={2200} className={inputClass} value={year} onChange={event => setYear(event.target.value)} /></label>
          <label className="text-sm">Season<input type="number" min={1} className={inputClass} value={season} onChange={event => setSeason(event.target.value)} /></label>
          <label className="text-sm">Episode<input type="number" min={1} className={inputClass} value={episode} onChange={event => setEpisode(event.target.value)} /></label>
        </div>
        <label className="block text-sm">Languages (comma-separated codes)<input className={inputClass} value={subtitles.languages} onChange={event => subtitles.setLanguages(event.target.value)} placeholder="en, hi, ta" /></label>
        <div className="flex flex-wrap gap-2">{subtitles.options.data?.languages.slice(0, 8).map(language => <button type="button" key={language.code} aria-pressed={languages.includes(language.code)} className={`${buttonClass} text-xs ${languages.includes(language.code) ? 'border-accent text-accent' : ''}`} onClick={() => subtitles.setLanguages((languages.includes(language.code) ? languages.filter(code => code !== language.code) : [...languages, language.code]).join(', '))}>{language.name}</button>)}</div>
        {!validLanguages && <p className="text-sm text-warning">Choose 1–10 language codes, such as en, hi, ta.</p>}
        <button disabled={!configured || !validLanguages || subtitles.search.isPending || subtitles.download.isPending} className={buttonClass}>{subtitles.search.isPending ? 'Searching…' : 'Search subtitles'}</button>
      </form>
      <div aria-live="polite" className="space-y-2">
        {subtitles.search.error && <p className="text-error">{subtitles.search.error.message}</p>}
        {subtitles.download.error && <p className="text-error">{subtitles.download.error.message}</p>}
        {subtitles.download.isSuccess && <p className="text-success">{subtitles.download.data.reused ? 'Already saved.' : 'Subtitle saved and available to your TV and mobile players.'} Local players can use the copy beside the video when that folder is writable.</p>}
        {subtitles.search.data?.warnings.map(warning => <p key={warning} className="text-sm text-warning">{warning}</p>)}
        {subtitles.search.isSuccess && !subtitles.search.data.results.length && <p>No matching subtitles. Try the filename or enter a title manually.</p>}
      </div>
      <ul className="space-y-2">{subtitles.search.data?.results.map(result => <li key={result.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
        <div className="min-w-0 flex-1"><p className="font-medium">{languageName(result.language)} · {result.provider}</p><p className="break-all text-sm text-muted">{result.releaseName}</p><p className="text-xs text-muted">{[result.format.toUpperCase(), result.hashMatch ? 'File hash match' : result.score >= 0.9 ? 'Release match' : null, result.hearingImpaired ? 'SDH' : null, result.forced ? 'Forced' : null, result.downloads ? `${result.downloads} downloads` : null].filter(Boolean).join(' · ')}</p></div>
        <button type="button" disabled={subtitles.download.isPending} className={buttonClass} onClick={() => subtitles.download.mutate(result.id)}>{subtitles.download.isPending && subtitles.download.variables === result.id ? 'Downloading…' : result.downloaded || subtitles.savedIds.has(result.id) ? 'Already saved' : 'Download'}</button>
      </li>)}</ul>
      {subtitles.available.data?.subtitles.length ? <div><h3 className="font-medium">Available subtitle files</h3><ul className="mt-2 space-y-1">{subtitles.available.data.subtitles.map(subtitle => <li key={subtitle.url}><a className="break-all text-sm text-accent hover:underline" href={subtitle.url} download>{subtitle.title || languageName(subtitle.language || '')} · {subtitle.codec}</a></li>)}</ul></div> : null}
    </div>
  </Modal>;
}
