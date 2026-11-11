import { findMode, type FindProvider, type Settings } from '@ottlib/shared';
import { HashlarkSettingsSection } from './HashlarkSettingsSection';
import { QbittorrentSettingsSection, type QbittorrentSettingsSectionProps } from './QbittorrentSettingsSection';

interface FindSettingsSectionProps {
  settings: Settings;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  provider: FindProvider;
  onProviderChange: (provider: FindProvider) => void;
  qbittorrent: Omit<QbittorrentSettingsSectionProps, 'settings'>;
}

const providers: { value: FindProvider; label: string }[] = [
  { value: 'qbittorrent', label: 'qBittorrent (search inside OttLib)' },
  { value: 'hashlark', label: 'Hashlark (opens on the server PC)' }
];

/** Find on/off, which app it uses, and that app's settings. */
export function FindSettingsSection({ settings, enabled, onEnabledChange, provider, onProviderChange, qbittorrent }: FindSettingsSectionProps) {
  return <section className="border-t border-border pt-5" aria-labelledby="find-heading">
    <label className="flex items-start gap-3">
      <input type="checkbox" checked={enabled} onChange={(event) => onEnabledChange(event.target.checked)} className="mt-1 h-4 w-4 accent-accent" />
      <span><span id="find-heading" className="block font-semibold">Find and torrent search</span><span className="mt-1 block text-sm text-muted">Optional. Adds Find buttons that search qBittorrent's plugins inside OttLib or hand the title to the Hashlark app on the server PC. Off by default; save settings after changing it.</span></span>
    </label>
    {enabled && <>
      <fieldset className="mt-4">
        <legend className="text-sm font-medium">Find with</legend>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6">
          {providers.map((option) => <label key={option.value} className="flex items-center gap-2 text-sm">
            <input type="radio" name="findProvider" value={option.value} checked={provider === option.value} onChange={() => onProviderChange(option.value)} className="h-4 w-4 accent-accent" />
            {option.label}
          </label>)}
        </div>
      </fieldset>
      {provider === 'qbittorrent' ? <QbittorrentSettingsSection settings={settings} {...qbittorrent} /> : <HashlarkSettingsSection saved={findMode(settings) === 'hashlark'} />}
    </>}
  </section>;
}
