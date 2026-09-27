import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import type { ScanRun, ServerInfo } from '@ottlib/shared';
import { useAutoAcceptBackfill, useFolders, useSettings, useSettingsActions } from '../hooks/useSettings';
import { useTheme } from '../hooks/useTheme';
import { api } from '../hooks/apiClient';
import { useScanHistory, useScanStatus, useStartScan } from '../hooks/useScanStatus';
import { ScanHistoryList } from '../components/ScanHistoryList';
import { ApiKeyField } from '../components/ApiKeyField';
import { useIsLocalClient } from '../hooks/useIsLocalClient';
import { useToast } from '../hooks/useToast';
import { ScheduleSettings } from '../components/ScheduleSettings';
import { schedulePresetFor, schedulePresets, type SchedulePresetId, useScheduleValidation } from '../hooks/useScheduleValidation';
import { MetadataRefreshDialog } from '../components/MetadataRefreshDialog';
import { useMetadataRefresh } from '../hooks/useMetadataRefresh';
import { QbittorrentSettingsSection } from '../components/QbittorrentSettingsSection';
import { SkeletonSettings } from '../components/Skeleton';
import { useSuccessPulse } from '../hooks/useSuccessPulse';

export function SettingsPage() {
  const settings = useSettings();
  const folders = useFolders();
  const actions = useSettingsActions();
  const history = useScanHistory();
  const scanStatus = useScanStatus();
  const scan = useStartScan();
  const autoAcceptBackfill = useAutoAcceptBackfill();
  const metadataRefresh = useMetadataRefresh();
  const { preference, setPreference } = useTheme();
  const { show } = useToast();
  const serverInfo = useQuery({ queryKey: ['server-info'], queryFn: () => api<ServerInfo>('/api/server-info') });
  const movieCount = useQuery({ queryKey: ['available-movie-count'], queryFn: () => api<{ total: number }>('/api/movies?availability=available&limit=1') });
  const scanFolderInput = useRef<HTMLInputElement>(null);
  const excludedFoldersInput = useRef<HTMLTextAreaElement>(null);
  const scheduleInitialized = useRef(false);
  const isLocal = useIsLocalClient();
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [schedulePreset, setSchedulePreset] = useState<SchedulePresetId>('nightly');
  const [customScheduleCron, setCustomScheduleCron] = useState('0 3 * * *');
  const [refreshDialogOpen, setRefreshDialogOpen] = useState(false);
  const scheduleValidation = useScheduleValidation(customScheduleCron, schedulePreset === 'custom');
  const saved = useSuccessPulse(actions.update.isSuccess);

  useEffect(() => {
    if (!settings.data || scheduleInitialized.current) return;
    scheduleInitialized.current = true;
    setScheduleEnabled(settings.data.scheduleEnabled);
    setSchedulePreset(schedulePresetFor(settings.data.scheduleCron));
    setCustomScheduleCron(settings.data.scheduleCron);
  }, [settings.data]);

  if (!settings.data) return <SkeletonSettings />;

  const current = settings.data;
  const scheduleCron = schedulePreset === 'custom' ? customScheduleCron.trim() : schedulePresets.find((preset) => preset.id === schedulePreset)!.cron;
  const customScheduleInvalid = schedulePreset === 'custom' && (!customScheduleCron.trim() || scheduleValidation.isFetching || scheduleValidation.data?.valid !== true);
  const browseForScanFolder = () => actions.pickFolder.mutate(undefined, {
    onSuccess: ({ path }) => { if (path && scanFolderInput.current) scanFolderInput.current.value = path; },
  });
  const browseForExcludedFolder = () => actions.pickFolder.mutate(undefined, {
    onSuccess: ({ path }) => {
      if (!path || !excludedFoldersInput.current) return;
      excludedFoldersInput.current.value = [excludedFoldersInput.current.value.trim(), path].filter(Boolean).join('\n');
    },
  });
  const startScan = () => {
    if (!folders.data?.length) return;
    scan.mutate(undefined, { onSuccess: () => { void history.refetch(); show('Library scan started.', 'success'); }, onError: (error) => show(error.message, 'error') });
  };
  const scanning = scan.isPending || scanStatus.data?.status === 'running';
  const autoAcceptRunStatus = autoAcceptBackfill.runStatus.data;
  const autoAcceptRunning: ScanRun | undefined = autoAcceptRunStatus?.status === 'running' ? autoAcceptRunStatus as ScanRun : undefined;

  return <section className="max-w-3xl space-y-8">
    <div>
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="mt-1 text-sm text-warning">Trusted-LAN mode: anyone on your private network can browse and stream this library.</p>
    </div>

    <section aria-labelledby="appearance-heading" className="rounded-xl border border-border bg-surface p-5">
      <h2 id="appearance-heading" className="font-semibold">Appearance</h2>
      <label className="mt-3 block text-sm">
        Theme
        <select value={preference} onChange={(event) => setPreference(event.target.value as typeof preference)} className="mt-1 block w-full rounded-lg border border-border bg-field px-3 py-2">
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System setting</option>
        </select>
      </label>
      <p className="mt-2 text-xs text-muted">This preference is saved on this device and applies immediately.</p>
    </section>

    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (customScheduleInvalid) return;
        const values = new FormData(event.currentTarget);
        const update = {
          extensions: String(values.get('extensions')).split(',').map((value) => value.trim()).filter(Boolean),
          ignoredPatterns: String(values.get('ignoredPatterns')).split(',').map((value) => value.trim()).filter(Boolean),
          excludedFolders: String(values.get('excludedFolders')).split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
          scheduleEnabled,
          scheduleCron,
          qbittorrentUrl: String(values.get('qbittorrentUrl') ?? '').trim(),
          qbittorrentUsername: String(values.get('qbittorrentUsername') ?? '').trim(),
          qbittorrentCategory: String(values.get('qbittorrentCategory') ?? '').trim(),
          qbittorrentSavePath: String(values.get('qbittorrentSavePath') ?? '').trim(),
        };
        const tmdbApiKey = values.get('tmdbApiKey'); if (typeof tmdbApiKey === 'string') Object.assign(update, { tmdbApiKey });
        const omdbApiKey = values.get('omdbApiKey'); if (typeof omdbApiKey === 'string') Object.assign(update, { omdbApiKey });
        const qbittorrentPassword = values.get('qbittorrentPassword'); if (typeof qbittorrentPassword === 'string') Object.assign(update, { qbittorrentPassword });
        actions.update.mutate(update);
      }}
      className="space-y-5 rounded-xl border border-border bg-surface p-5"
    >
      <h2 className="font-semibold">Library and metadata</h2>
      <ApiKeyField id="tmdb-api-key" name="tmdbApiKey" label="TMDb API key" maskedValue={current.tmdbApiKey} required={Boolean(current.tmdbApiKey)} testing={actions.testTmdbKey.isPending} testSuccess={actions.testTmdbKey.isSuccess} onTest={(value) => actions.testTmdbKey.mutate(value)} help={<>Create a free key in your TMDb account, then test it before saving. <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer" className="text-accent hover:underline">Get a TMDb API key</a></>} />
      <ApiKeyField id="omdb-api-key" name="omdbApiKey" label="OMDb API key" maskedValue={current.omdbApiKey} required={Boolean(current.omdbApiKey)} />
      <label className="block text-sm">Video extensions (comma-separated)<input name="extensions" defaultValue={current.extensions.join(', ')} className="mt-1 w-full rounded-lg border border-border bg-field px-3 py-2" /></label>
      <label className="block text-sm">Ignored folder names (comma-separated)<input name="ignoredPatterns" defaultValue={current.ignoredPatterns.join(', ')} className="mt-1 w-full rounded-lg border border-border bg-field px-3 py-2" /></label>
      <label className="block text-sm">
        Excluded folder paths (one per line)
        <textarea ref={excludedFoldersInput} name="excludedFolders" defaultValue={current.excludedFolders.join('\n')} placeholder={'E:\\Movies\\Downloads\nE:\\Movies\\Private'} className="mt-1 min-h-24 w-full rounded-lg border border-border bg-field px-3 py-2" />
        <span className="mt-1 block text-xs text-muted">Each folder and everything inside it will be skipped during scans.</span>
      </label>
      {isLocal ? <button type="button" onClick={browseForExcludedFolder} disabled={actions.pickFolder.isPending} className="rounded-lg border border-border-strong px-4 py-2 text-sm hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-60">{actions.pickFolder.isPending ? 'Opening…' : 'Browse excluded folder…'}</button> : <p className="text-xs text-muted">Type a path on the server, e.g. E:\\Movies.</p>}
      <ScheduleSettings enabled={scheduleEnabled} onEnabledChange={setScheduleEnabled} preset={schedulePreset} onPresetChange={setSchedulePreset} customCron={customScheduleCron} onCustomCronChange={setCustomScheduleCron} validation={scheduleValidation} />
      <QbittorrentSettingsSection settings={current} testing={actions.testQbittorrent.isPending} testSuccess={actions.testQbittorrent.isSuccess && actions.testQbittorrent.data?.status === 'connected'} onTest={() => actions.testQbittorrent.mutate()} testError={actions.testQbittorrent.error?.message} testMessage={actions.testQbittorrent.data?.message} testConnected={actions.testQbittorrent.data?.status === 'connected'} />
      <button disabled={actions.update.isPending || customScheduleInvalid} className={`rounded-lg bg-accent px-4 py-2 font-medium text-accent-foreground transition-[background-color,transform] duration-fast ease-emphasis hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 ${saved ? 'bg-success text-success-foreground hover:bg-success' : ''}`}>{actions.update.isPending ? 'Saving…' : saved ? 'Saved' : 'Save settings'}</button>
      {actions.update.error && <p className="text-sm text-error">{actions.update.error.message}</p>}
    </form>

    <section id="scan-folders" className="rounded-xl border border-border bg-surface p-5">
      <h2 className="font-semibold">Scan folders</h2>
      <form onSubmit={(event) => {
        event.preventDefault();
        const path = new FormData(event.currentTarget).get('path');
        if (typeof path === 'string' && path) actions.addFolder.mutate(path);
        event.currentTarget.reset();
      }} className="mt-3 flex gap-2">
        <input ref={scanFolderInput} name="path" placeholder="E:\\Movies" className="min-w-0 flex-1 rounded-lg border border-border bg-field px-3 py-2" />
        {isLocal && <button type="button" onClick={browseForScanFolder} disabled={actions.pickFolder.isPending} className="rounded-lg border border-border-strong px-4 py-2 hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-60">{actions.pickFolder.isPending ? 'Opening…' : 'Browse…'}</button>}
        <button className="rounded-lg border border-border-strong px-4 py-2 hover:bg-surface-raised">Add</button>
      </form>
      {!isLocal && <p className="mt-2 text-xs text-muted">Type a path on the server, e.g. E:\\Movies.</p>}
      <ul className="mt-4 space-y-2">
        {folders.data?.map((folder) => <li key={folder.id} className="flex items-center justify-between rounded bg-field px-3 py-2 text-sm"><span className="truncate">{folder.path}</span><button onClick={() => actions.removeFolder.mutate(folder.id)} className="ml-3 text-error hover:text-error-hover">Remove</button></li>)}
      </ul>
    </section>

    <section className="rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Library maintenance</h2><p className="mt-1 text-sm text-muted">Refresh your files and apply metadata suggestions that were already found.</p></div><button type="button" onClick={startScan} disabled={!folders.data?.length || scanning} className="rounded-lg border border-border-strong px-3 py-1.5 text-sm font-medium hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-60">{scanning ? 'Scanning…' : 'Rescan now'}</button></div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-field p-3">
        <div><p className="text-sm font-medium">Accept confident existing matches</p><p className="mt-1 text-xs text-muted">Uses saved suggestions only; individual titles can still be corrected from Fix this match.</p></div>
        <button type="button" onClick={() => autoAcceptBackfill.run.mutate()} disabled={autoAcceptBackfill.status.isLoading || autoAcceptBackfill.run.isPending || Boolean(autoAcceptRunning) || !autoAcceptBackfill.status.data?.eligible} className="rounded-lg border border-border-strong px-3 py-1.5 text-sm font-medium hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-60">{autoAcceptBackfill.run.isPending || autoAcceptRunning ? <span className="tabular-nums">Accepting {autoAcceptRunning?.filesProcessed ?? 0} of {autoAcceptRunning?.filesFound ?? autoAcceptBackfill.status.data?.eligible ?? 0}…</span> : <span className="tabular-nums">Accept {autoAcceptBackfill.status.data?.eligible ?? 0} confident matches</span>}</button>
      </div>
      {autoAcceptBackfill.runStatus.data?.status === 'completed' && <p className="mt-3 whitespace-pre-wrap text-sm text-muted">Accepted {autoAcceptBackfill.runStatus.data.titlesAdded} matches.{autoAcceptBackfill.runStatus.data.errorSummary && ` ${autoAcceptBackfill.runStatus.data.errorSummary}`}</p>}
      {autoAcceptBackfill.run.error && <p className="mt-3 text-sm text-error">{autoAcceptBackfill.run.error.message}</p>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning-border/50 bg-warning-soft p-3"><div><p className="text-sm font-medium text-warning">Refresh all metadata</p><p className="mt-1 text-xs text-muted">Rechecks every available title. Automatic titles, artwork, and details may change; manual title overrides remain.</p></div><button type="button" onClick={() => setRefreshDialogOpen(true)} disabled={metadataRefresh.status.data?.status === 'running'} className="rounded-lg border border-warning-border px-3 py-1.5 text-sm font-medium text-warning hover:bg-warning-border/15 disabled:cursor-not-allowed disabled:opacity-60">Refresh all metadata</button></div>
    </section>

    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="font-semibold">Recent scans</h2>
      <ScanHistoryList runs={history.data} />
    </section>

    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="font-semibold">Connect from your phone</h2>
      <p className="mt-2 text-sm text-muted">Open one of these addresses while on the same Wi-Fi network:</p>
      <div className="mt-3 space-y-1 font-mono text-sm text-accent">{serverInfo.data?.addresses.map((address) => <div key={address}>http://{address}:{serverInfo.data?.port}</div>) || <div>No LAN address detected.</div>}</div>
    </section>
    <MetadataRefreshDialog open={refreshDialogOpen} title="Refresh all library metadata" count={movieCount.data?.total ?? 0} running={metadataRefresh.start.isPending} onClose={() => setRefreshDialogOpen(false)} onConfirm={() => metadataRefresh.start.mutate(undefined, { onSuccess: () => setRefreshDialogOpen(false) })} />
  </section>;
}
