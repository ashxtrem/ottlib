import { useQuery } from '@tanstack/react-query';
import type { ScheduleValidationResult } from '@ottlib/shared';
import { api } from './apiClient';
import { useDebouncedValue } from './useDebouncedValue';

export type SchedulePresetId = 'nightly' | 'twiceDaily' | 'weekly' | 'custom';

export const schedulePresets = [
  { id: 'nightly', label: 'Every night', description: 'Daily at 3:00 AM', cron: '0 3 * * *' },
  { id: 'twiceDaily', label: 'Twice daily', description: 'At 3:00 AM and 3:00 PM', cron: '0 3,15 * * *' },
  { id: 'weekly', label: 'Weekly', description: 'Every Sunday at 3:00 AM', cron: '0 3 * * 0' }
] as const;

export function schedulePresetFor(cron: string): SchedulePresetId {
  return schedulePresets.find((preset) => preset.cron === cron.trim())?.id ?? 'custom';
}

function atTime(now: Date, hour: number): Date {
  const next = new Date(now); next.setHours(hour, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next;
}

export function nextRunForPreset(preset: Exclude<SchedulePresetId, 'custom'>, now = new Date()): Date {
  if (preset === 'nightly') return atTime(now, 3);
  if (preset === 'twiceDaily') return [atTime(now, 3), atTime(now, 15)].sort((first, second) => first.getTime() - second.getTime())[0];
  const next = new Date(now); next.setHours(3, 0, 0, 0);
  next.setDate(next.getDate() + (7 - next.getDay()) % 7);
  if (next <= now) next.setDate(next.getDate() + 7);
  return next;
}

export function describeNextScheduleRun(nextRun: Date, now = new Date()): string {
  const dayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const daysAway = Math.round((dayStart(nextRun) - dayStart(now)) / 86_400_000);
  const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(nextRun);
  if (daysAway === 0) return `today at ${time}`;
  if (daysAway === 1 && nextRun.getHours() < 6) return `tonight at ${time}`;
  if (daysAway === 1) return `tomorrow at ${time}`;
  const date = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).format(nextRun);
  return `on ${date} at ${time}`;
}

export function useScheduleValidation(cron: string, enabled: boolean) {
  const debouncedCron = useDebouncedValue(cron.trim());
  return useQuery({
    queryKey: ['schedule-validation', debouncedCron],
    enabled: enabled && Boolean(debouncedCron),
    queryFn: () => api<ScheduleValidationResult>('/api/settings/schedule/validate', { method: 'POST', body: JSON.stringify({ scheduleCron: debouncedCron }) }),
    retry: false
  });
}
