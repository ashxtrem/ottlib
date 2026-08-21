import { useQuery } from '@tanstack/react-query';
import { useRef } from 'react';
import { useFolders, useSettings, useSettingsActions } from '../hooks/useSettings';
import { useTheme } from '../hooks/useTheme';
import { api } from '../hooks/apiClient';
import { useScanHistory } from '../hooks/useScanStatus';

export function SettingsPage() {
  const settings = useSettings();
  const folders = useFolders();
  const actions = useSettingsActions();
  const history = useScanHistory();
  const { preference, setPreference } = useTheme();
  const serverInfo = useQuery({ queryKey: ['server-info'], queryFn: () => api<{ port: number; addresses: string[] }>('/api/server-info') });
  const scanFolderInput = useRef<HTMLInputElement>(null);
  const excludedFoldersInput = useRef<HTMLTextAreaElement>(null);

  if (!settings.data) return <p className="text-muted">Loading settings…</p>;

  const current = settings.data;
  const browseForScanFolder = () => actions.pickFolder.mutate(undefined, {
    onSuccess: ({ path }) => { if (path && scanFolderInput.current) scanFolderInput.current.value = path; },
  });
  const browseForExcludedFolder = () => actions.pickFolder.mutate(undefined, {
    onSuccess: ({ path }) => {
      if (!path || !excludedFoldersInput.current) return;
      excludedFoldersInput.current.value = [excludedFoldersInput.current.value.trim(), path].filter(Boolean).join('\n');
    },
  });

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
        const values = new FormData(event.currentTarget);
        actions.update.mutate({
          tmdbApiKey: String(values.get('tmdbApiKey')),
          omdbApiKey: String(values.get('omdbApiKey')),
          extensions: String(values.get('extensions')).split(',').map((value) => value.trim()).filter(Boolean),
          ignoredPatterns: String(values.get('ignoredPatterns')).split(',').map((value) => value.trim()).filter(Boolean),
          excludedFolders: String(values.get('excludedFolders')).split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
          scheduleEnabled: values.get('scheduleEnabled') === 'on',
          scheduleCron: String(values.get('scheduleCron')),
        });
      }}
      className="space-y-5 rounded-xl border border-border bg-surface p-5"
    >
      <h2 className="font-semibold">Library and metadata</h2>
      <label className="block text-sm">TMDb API key<input name="tmdbApiKey" defaultValue={current.tmdbApiKey} className="mt-1 w-full rounded-lg border border-border bg-field px-3 py-2" /></label>
      <label className="block text-sm">OMDb API key<input name="omdbApiKey" defaultValue={current.omdbApiKey} className="mt-1 w-full rounded-lg border border-border bg-field px-3 py-2" /></label>
      <label className="block text-sm">Video extensions (comma-separated)<input name="extensions" defaultValue={current.extensions.join(', ')} className="mt-1 w-full rounded-lg border border-border bg-field px-3 py-2" /></label>
      <label className="block text-sm">Ignored folder names (comma-separated)<input name="ignoredPatterns" defaultValue={current.ignoredPatterns.join(', ')} className="mt-1 w-full rounded-lg border border-border bg-field px-3 py-2" /></label>
      <label className="block text-sm">
        Excluded folder paths (one per line)
        <textarea ref={excludedFoldersInput} name="excludedFolders" defaultValue={current.excludedFolders.join('\n')} placeholder={'E:\\Movies\\Downloads\nE:\\Movies\\Private'} className="mt-1 min-h-24 w-full rounded-lg border border-border bg-field px-3 py-2" />
        <span className="mt-1 block text-xs text-muted">Each folder and everything inside it will be skipped during scans.</span>
      </label>
      <button type="button" onClick={browseForExcludedFolder} disabled={actions.pickFolder.isPending} className="rounded-lg border border-border-strong px-4 py-2 text-sm hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-60">{actions.pickFolder.isPending ? 'Opening…' : 'Browse excluded folder…'}</button>
      <label className="flex items-center gap-2 text-sm"><input name="scheduleEnabled" type="checkbox" defaultChecked={current.scheduleEnabled} /> Enable scheduled rescan</label>
      <label className="block text-sm">Cron schedule<input name="scheduleCron" defaultValue={current.scheduleCron} className="mt-1 w-full rounded-lg border border-border bg-field px-3 py-2" /></label>
      <button className="rounded-lg bg-accent px-4 py-2 font-medium text-accent-foreground hover:bg-accent-hover">Save settings</button>
      {actions.update.error && <p className="text-sm text-error">{actions.update.error.message}</p>}
    </form>

    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="font-semibold">Scan folders</h2>
      <form onSubmit={(event) => {
        event.preventDefault();
        const path = new FormData(event.currentTarget).get('path');
        if (typeof path === 'string' && path) actions.addFolder.mutate(path);
        event.currentTarget.reset();
      }} className="mt-3 flex gap-2">
        <input ref={scanFolderInput} name="path" placeholder="E:\\Movies" className="min-w-0 flex-1 rounded-lg border border-border bg-field px-3 py-2" />
        <button type="button" onClick={browseForScanFolder} disabled={actions.pickFolder.isPending} className="rounded-lg border border-border-strong px-4 py-2 hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-60">{actions.pickFolder.isPending ? 'Opening…' : 'Browse…'}</button>
        <button className="rounded-lg border border-border-strong px-4 py-2 hover:bg-surface-raised">Add</button>
      </form>
      <ul className="mt-4 space-y-2">
        {folders.data?.map((folder) => <li key={folder.id} className="flex items-center justify-between rounded bg-field px-3 py-2 text-sm"><span className="truncate">{folder.path}</span><button onClick={() => actions.removeFolder.mutate(folder.id)} className="ml-3 text-error hover:text-error-hover">Remove</button></li>)}
      </ul>
    </section>

    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="font-semibold">Recent scans</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {history.data?.length ? history.data.map((run) => <li key={run.id} className="flex justify-between rounded bg-field px-3 py-2"><span className={run.status === 'completed' ? 'text-success' : run.status === 'failed' ? 'text-error' : 'text-accent'}>{run.status}</span><span className="text-muted">{run.filesProcessed} files · {run.startedAt}</span></li>) : <li className="text-muted">No scans yet.</li>}
      </ul>
    </section>

    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="font-semibold">Connect from your phone</h2>
      <p className="mt-2 text-sm text-muted">Open one of these addresses while on the same Wi-Fi network:</p>
      <div className="mt-3 space-y-1 font-mono text-sm text-accent">{serverInfo.data?.addresses.map((address) => <div key={address}>http://{address}:{serverInfo.data?.port}</div>) || <div>No LAN address detected.</div>}</div>
    </section>
  </section>;
}
