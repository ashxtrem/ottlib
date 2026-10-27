import type { ReactNode } from 'react';
import type { AutoSkipDefaults } from '@ottlib/shared';
import { useAutoSkipDefaults } from '../hooks/useAutoSkipDefaults';

interface ToggleRowProps {
  id: string;
  label: string;
  help: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}

/** One on/off row of the Player section. */
export function PlayerToggleRow({ id, label, help, checked, disabled, onChange }: ToggleRowProps) {
  return <label htmlFor={id} className="flex items-start gap-3 py-3">
    <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 accent-accent" />
    <span><span className="block text-sm font-medium">{label}</span><span className="mt-0.5 block text-xs text-muted">{help}</span></span>
  </label>;
}

interface PlayerSettingsViewProps {
  defaults: AutoSkipDefaults | undefined;
  saving: boolean;
  error?: string;
  onChange: (defaults: AutoSkipDefaults) => void;
  /** More rows (e.g. the picture default on this device). */
  children?: ReactNode;
}

/** Presentational Player section: the profile's auto-skip credits defaults, saved as they change. */
export function PlayerSettingsView({ defaults, saving, error, onChange, children }: PlayerSettingsViewProps) {
  return <section aria-labelledby="player-heading" className="rounded-xl border border-border bg-surface p-5">
    <h2 id="player-heading" className="font-semibold">Player</h2>
    <p className="mt-1 text-sm text-muted">For this profile. When credits are skipped and something plays next, it starts as the credits begin. Change one title from the player's More menu.</p>
    <div className="mt-2 divide-y divide-border">
      <PlayerToggleRow id="auto-skip-movie" label="Auto-skip credits in movies" help="The next title starts at the credits." checked={defaults?.movie ?? false} disabled={!defaults || saving} onChange={(movie) => defaults && onChange({ ...defaults, movie })} />
      <PlayerToggleRow id="auto-skip-tv" label="Auto-skip credits in TV episodes" help="The next episode starts at the credits." checked={defaults?.tv ?? false} disabled={!defaults || saving} onChange={(tv) => defaults && onChange({ ...defaults, tv })} />
      {children}
    </div>
    {error && <p role="alert" className="mt-2 text-sm text-error">{error}</p>}
  </section>;
}

/** Settings → Player: loads and saves the current profile's defaults. */
export function PlayerSettingsSection() {
  const { defaults, update } = useAutoSkipDefaults();
  return <PlayerSettingsView defaults={defaults.data} saving={update.isPending} error={update.error?.message ?? defaults.error?.message} onChange={(next) => update.mutate(next)} />;
}
