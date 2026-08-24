import type { UseQueryResult } from '@tanstack/react-query';
import type { ScheduleValidationResult } from '@ottlib/shared';
import { describeNextScheduleRun, nextRunForPreset, schedulePresets, type SchedulePresetId } from '../hooks/useScheduleValidation';
import { focusRing, pressable } from './interactionStyles';

interface ScheduleSettingsProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  preset: SchedulePresetId;
  onPresetChange: (preset: SchedulePresetId) => void;
  customCron: string;
  onCustomCronChange: (cron: string) => void;
  validation: UseQueryResult<ScheduleValidationResult>;
}

export function ScheduleSettings({ enabled, onEnabledChange, preset, onPresetChange, customCron, onCustomCronChange, validation }: ScheduleSettingsProps) {
  const checking = validation.isFetching && Boolean(customCron.trim());
  const customError = !customCron.trim() ? 'Enter a cron expression.' : validation.data?.valid === false ? validation.data.error : validation.isError ? 'Unable to validate this schedule right now.' : undefined;
  const nextRun = preset === 'custom'
    ? validation.data?.valid && validation.data.nextRun ? new Date(validation.data.nextRun) : undefined
    : nextRunForPreset(preset);

  return <fieldset className="space-y-3 rounded-lg border border-border bg-field/40 p-4">
    <legend className="px-1 text-sm font-semibold">Automatic rescan</legend>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={(event) => onEnabledChange(event.target.checked)} className={focusRing} /> Enable scheduled rescan</label>
    <div role="radiogroup" aria-label="Rescan frequency" className="grid gap-2 sm:grid-cols-2">
      {schedulePresets.map((option) => <label key={option.id} className={`cursor-pointer rounded-lg border p-3 text-sm transition-[border-color,background-color,transform] duration-fast ease-emphasis ${pressable} ${preset === option.id ? 'border-accent bg-accent-soft' : 'border-border hover:bg-surface-raised'}`}><input type="radio" name="schedulePreset" value={option.id} checked={preset === option.id} onChange={() => onPresetChange(option.id)} className="sr-only" /><span className="block font-medium">{option.label}</span><span className="mt-0.5 block text-xs text-muted">{option.description}</span></label>)}
      <label className={`cursor-pointer rounded-lg border p-3 text-sm transition-[border-color,background-color,transform] duration-fast ease-emphasis ${pressable} ${preset === 'custom' ? 'border-accent bg-accent-soft' : 'border-border hover:bg-surface-raised'}`}><input type="radio" name="schedulePreset" value="custom" checked={preset === 'custom'} onChange={() => onPresetChange('custom')} className="sr-only" /><span className="block font-medium">Custom</span><span className="mt-0.5 block text-xs text-muted">Enter your own cron expression</span></label>
    </div>
    {preset === 'custom' && <label className="block text-sm" htmlFor="schedule-cron">Cron schedule<input id="schedule-cron" value={customCron} onChange={(event) => onCustomCronChange(event.target.value)} aria-invalid={Boolean(customError)} aria-describedby="schedule-cron-help schedule-cron-feedback" placeholder="0 3 * * *" className={`mt-1 w-full rounded-lg border bg-field px-3 py-2 font-mono transition-colors duration-fast ${focusRing} ${customError ? 'border-error' : checking ? 'border-accent' : 'border-border'}`} /><span id="schedule-cron-help" className="mt-1 block text-xs text-muted">Use minute, hour, day of month, month, and day of week — for example, <code>0 3 * * *</code> runs every day at 3:00 AM.</span><span id="schedule-cron-feedback" role="status" className={`mt-1 block min-h-[1.25rem] text-xs ${customError ? 'animate-rise-in text-error' : 'text-muted'}`}>{customError ?? (checking ? 'Checking schedule…' : '')}</span></label>}
    {nextRun && <p className="text-sm text-muted">{enabled ? 'Next scan' : 'Next scan when enabled'}: {describeNextScheduleRun(nextRun)}.</p>}
  </fieldset>;
}
