import type { Settings } from '@ottlib/shared';
import { useSuccessPulse } from '../hooks/useSuccessPulse';
import { focusRing, pressable } from './interactionStyles';

interface QbittorrentSettingsSectionProps {
  settings: Settings;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  testing: boolean;
  onTest: () => void;
  testError?: string;
  testMessage?: string;
  testConnected?: boolean;
  testSuccess?: boolean;
}

export function QbittorrentSettingsSection({ settings, enabled, onEnabledChange, testing, onTest, testError, testMessage, testConnected, testSuccess = false }: QbittorrentSettingsSectionProps) {
  const tested = useSuccessPulse(testSuccess);
  return <section className="border-t border-border pt-5" aria-labelledby="qbittorrent-heading">
    <label className="flex items-start gap-3">
      <input type="checkbox" checked={enabled} onChange={(event) => onEnabledChange(event.target.checked)} className="mt-1 h-4 w-4 accent-accent" />
      <span><span id="qbittorrent-heading" className="block font-semibold">Torrent search (qBittorrent)</span><span className="mt-1 block text-sm text-muted">Optional. Search your qBittorrent's installed search plugins from OttLib and send releases back to it. Off by default; save settings after changing it.</span></span>
    </label>
    {enabled && <>
    <div className="mt-4">
      <p className="text-sm text-warning">OttLib stores this password. In trusted-LAN mode, anyone who can reach OttLib can search and add torrents to qBittorrent.</p>
      <p className="mt-2 text-sm text-muted">In qBittorrent, open <strong>Tools → Options → Web UI</strong>, enable the Web User Interface, and set a username and password. Enter its URL here (for example, <code>http://127.0.0.1:8080</code>), then save and test. See the <a href="https://github.com/qbittorrent/qBittorrent/wiki" target="_blank" rel="noreferrer" className="text-accent hover:underline">official qBittorrent WebUI guide</a>.</p>
    </div>
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <label className="block text-sm sm:col-span-2">WebUI URL<input name="qbittorrentUrl" type="url" defaultValue={settings.qbittorrentUrl} placeholder="http://127.0.0.1:8080" className="mt-1 w-full rounded-lg border border-border bg-field px-3 py-2" /></label>
      <label className="block text-sm">Username<input name="qbittorrentUsername" autoComplete="username" defaultValue={settings.qbittorrentUsername} className="mt-1 w-full rounded-lg border border-border bg-field px-3 py-2" /></label>
      <label className="block text-sm">Password<input name="qbittorrentPassword" type="password" autoComplete="current-password" defaultValue={settings.qbittorrentPassword} placeholder="Enter password" className="mt-1 w-full rounded-lg border border-border bg-field px-3 py-2" /></label>
      <label className="block text-sm">Default category<input name="qbittorrentCategory" defaultValue={settings.qbittorrentCategory} placeholder="ottlib" className="mt-1 w-full rounded-lg border border-border bg-field px-3 py-2" /></label>
      <label className="block text-sm">Default save path (optional)<input name="qbittorrentSavePath" defaultValue={settings.qbittorrentSavePath} placeholder="E:\\Movies\\Downloads" className="mt-1 w-full rounded-lg border border-border bg-field px-3 py-2" /></label>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" onClick={onTest} disabled={testing} className={`rounded-lg border border-border-strong px-4 py-2 text-sm font-medium transition-[background-color,transform] duration-fast ease-emphasis hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-60 ${focusRing} ${pressable} ${tested ? 'border-success bg-success text-success-foreground hover:bg-success' : ''}`}>{testing ? 'Testing…' : tested ? 'Connected' : 'Test saved connection'}</button><span className="text-xs text-muted">Save settings before testing. qBittorrent needs Python and installed Search plugins.</span></div>
    {testMessage && <p className={`mt-3 text-sm ${testConnected ? 'text-success' : 'text-warning'}`}>{testMessage}</p>}
    {testError && <p className="mt-3 text-sm text-error">{testError}</p>}
    </>}
  </section>;
}
