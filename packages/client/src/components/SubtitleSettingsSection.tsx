import type { UpdateSettings } from '@ottlib/shared';
import { useSettings, useSettingsActions } from '../hooks/useSettings';
import { ApiKeyField } from './ApiKeyField';

export function SubtitleSettingsSection() {
  const settings = useSettings(); const { update } = useSettingsActions();
  if (!settings.data) return null;
  const current = settings.data;
  return <form className="space-y-4 rounded-xl border border-border bg-surface p-5" onSubmit={event => {
    event.preventDefault(); const values = new FormData(event.currentTarget);
    const changes: UpdateSettings = { opensubtitlesUsername: String(values.get('opensubtitlesUsername') ?? '').trim(), subtitleSearchLanguages: String(values.get('subtitleSearchLanguages')).toLowerCase().split(',').map(value => value.trim()).filter(Boolean) };
    for (const key of ['opensubtitlesApiKey', 'opensubtitlesPassword', 'subdlApiKey'] as const) {
      const value = values.get(key); if (typeof value === 'string') changes[key] = value.trim();
    }
    update.mutate(changes);
  }}>
    <h2 className="font-semibold">Subtitle downloads</h2>
    <p className="text-sm text-muted">Configure either service once for web, Android TV, and mobile. Downloads are saved on this server; provider quotas apply.</p>
    <ApiKeyField id="opensubtitles-key" name="opensubtitlesApiKey" label="OpenSubtitles API key" maskedValue={current.opensubtitlesApiKey} help={<a className="text-accent hover:underline" href="https://www.opensubtitles.com/consumers" target="_blank" rel="noreferrer">Get an OpenSubtitles API key</a>} />
    <label className="block text-sm">OpenSubtitles username (optional)<input name="opensubtitlesUsername" autoComplete="off" defaultValue={current.opensubtitlesUsername} className="mt-1 w-full rounded-lg border border-border bg-field px-3 py-2" /></label>
    <ApiKeyField id="opensubtitles-password" name="opensubtitlesPassword" label="OpenSubtitles account password" maskedValue={current.opensubtitlesPassword} help="Optional account sign-in provides your account’s download allowance." />
    <ApiKeyField id="subdl-key" name="subdlApiKey" label="SubDL API key" maskedValue={current.subdlApiKey} help={<a className="text-accent hover:underline" href="https://subdl.com/developers" target="_blank" rel="noreferrer">Get a SubDL API key</a>} />
    <label className="block text-sm">Default search languages<input name="subtitleSearchLanguages" defaultValue={current.subtitleSearchLanguages.join(', ')} placeholder="en, hi, ta" className="mt-1 w-full rounded-lg border border-border bg-field px-3 py-2" /><span className="text-xs text-muted">Comma-separated codes. Each device remembers its own search languages separately from subtitles on/off.</span></label>
    <button disabled={update.isPending} className="rounded-lg bg-accent px-4 py-2 text-accent-foreground disabled:opacity-50">{update.isPending ? 'Saving…' : 'Save subtitle settings'}</button>
    {update.isSuccess && <p role="status" className="text-sm text-success">Subtitle settings saved.</p>}
    {update.error && <p role="alert" className="text-sm text-error">{update.error.message}</p>}
  </form>;
}
