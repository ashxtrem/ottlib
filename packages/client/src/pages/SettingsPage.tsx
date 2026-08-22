import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useFolders, useSettings, useSettingsActions } from '../hooks/useSettings';
import { useTheme } from '../hooks/useTheme';
import { api } from '../hooks/apiClient';
import { useScanHistory, useScanStatus, useStartScan } from '../hooks/useScanStatus';
import { ScanHistoryList } from '../components/ScanHistoryList';
import { ApiKeyField } from '../components/ApiKeyField';
import { useIsLocalClient } from '../hooks/useIsLocalClient';
import { useToast } from '../hooks/useToast';
import { ScheduleSettings } from '../components/ScheduleSettings';
import { schedulePresetFor, schedulePresets, type SchedulePresetId, useScheduleValidation } from '../hooks/useScheduleValidation';

export function SettingsPage() {
  const settings = useSettings();
  const folders = useFolders();
  const actions = useSettingsActions();
  const history = useScanHistory();
  const scanStatus = useScanStatus();
  const scan = useStartScan();
  const { preference, setPreference } = useTheme();
  const { show } = useToast();
  const serverInfo = useQuery({ queryKey: ['server-info'], queryFn: () => api<{ port: number; addresses: string[] }>('/api/server-info') });
  const scanFolderInput = useRef<HTMLInputElement>(null);
  const excludedFoldersInput = useRef<HTMLTextAreaElement>(null);
  const scheduleInitialized = useRef(false);
  const isLocal = useIsLocalClient();
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [schedulePreset, setSchedulePreset] = useState<SchedulePresetId>('nightly');
  const [customScheduleCron, setCustomScheduleCron] = useState('0 3 * * *');
  const scheduleValidation = useScheduleValidation(customScheduleCron, schedulePreset === 'custom');

  useEffect(() => {
    if (!settings.data || scheduleInitialized.current) return;
    scheduleInitialized.current = true;
    setScheduleEnabled(settings.data.scheduleEnabled);
    setSchedulePreset(schedulePresetFor(settings.data.scheduleCron));
    setCustomScheduleCron(settings.data.scheduleCron);
  }, [settings.data]);

  if (!settings.data) return <p className="text-muted">Loading settings…</p>;

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
    if (!folders.data?.length || (history.data?.length && !window.confirm('Rescan your library? This may take a while, depending on the number of files.'))) return;
    scan.mutate(undefined, { onSuccess: () => { void history.refetch(); show('Library scan started.', 'success'); }, onError: (error) => show(error.message, 'error') });
  };
  const scanning = scan.isPending || scanStatus.data?.status === 'running';

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
        };
        const tmdbApiKey = values.get('tmdbApiKey'); if (typeof tmdbApiKey === 'string') Object.assign(update, { tmdbApiKey });
        const omdbApiKey = values.get('omdbApiKey'); if (typeof omdbApiKey === 'string') Object.assign(update, { omdbApiKey });
        actions.update.mutate(update);
      }}
      className="space-y-5 rounded-xl border border-border bg-surface p-5"
    >
      <h2 className="font-semibold">Library and metadata</h2>
      <ApiKeyField id="tmdb-api-key" name="tmdbApiKey" label="TMDb API key" maskedValue={current.tmdbApiKey} required={Boolean(current.tmdbApiKey)} testing={actions.testTmdbKey.isPending} onTest={(value) => actions.testTmdbKey.mutate(value)} help={<>Create a free key in your TMDb account, then test it before saving. <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer" className="text-accent hover:underline">Get a TMDb API key</a></>} />
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
      <button disabled={actions.update.isPending || customScheduleInvalid} className="rounded-lg bg-accent px-4 py-2 font-medium text-accent-foreground hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60">{actions.update.isPending ? 'Saving…' : 'Save settings'}</button>
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
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Recent scans</h2><button type="button" onClick={startScan} disabled={!folders.data?.length || scanning} className="rounded-lg border border-border-strong px-3 py-1.5 text-sm font-medium hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-60">{scanning ? 'Scanning…' : 'Rescan now'}</button></div>
      <ScanHistoryList runs={history.data} />
    </section>

    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="font-semibold">Connect from your phone</h2>
      <p className="mt-2 text-sm text-muted">Open one of these addresses while on the same Wi-Fi network:</p>
      <div className="mt-3 space-y-1 font-mono text-sm text-accent">{serverInfo.data?.addresses.map((address) => <div key={address}>http://{address}:{serverInfo.data?.port}</div>) || <div>No LAN address detected.</div>}</div>
    </section>
  </section>;
}
