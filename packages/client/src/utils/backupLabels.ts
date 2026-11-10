import type { BackupKindName } from '@ottlib/shared';
import { ApiError } from '../hooks/apiClient';

export const backupKindLabels: Record<BackupKindName, string> = {
  manual: 'Manual',
  daily: 'Daily',
  'pre-update': 'Before update',
  'before-restore': 'Before restore'
};

export const restoreForbiddenMessage = 'Restore only works on the server PC';

/** Why Restore is off for this browser, or null when it is allowed. The server enforces the same rule. */
export function restoreDisabledReason(isLocalClient: boolean): string | null {
  return isLocalClient ? null : 'Restore is only available when you open OttLib on the server PC.';
}

/** Shows the server's 403 on a restore as the plain reason; anything else keeps its own message. */
export function restoreErrorMessage(error: Error): string {
  return error instanceof ApiError && error.status === 403 ? restoreForbiddenMessage : error.message;
}

export function formatBackupSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

export function formatBackupDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
