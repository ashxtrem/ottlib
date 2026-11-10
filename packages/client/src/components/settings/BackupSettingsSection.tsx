import type { Backup } from '@ottlib/shared';
import { useBackups } from '../../hooks/useBackups';
import { useIsLocalClient } from '../../hooks/useIsLocalClient';
import { useSettings, useSettingsActions } from '../../hooks/useSettings';
import { backupKindLabels, formatBackupDate, formatBackupSize, restoreDisabledReason, restoreErrorMessage } from '../../utils/backupLabels';

type BackupSectionViewProps = {
  enabled: boolean;
  savingEnabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  backups: Backup[] | undefined;
  listError?: string;
  creating: boolean;
  onCreate: () => void;
  /** Name of the backup being deleted or restored right now. */
  busyName?: string;
  onDelete: (backup: Backup) => void;
  onRestore: (backup: Backup) => void;
  isLocalClient: boolean;
  actionError?: string;
  restartPending: boolean;
};

const buttonClass = 'rounded-lg border border-border-strong px-3 py-1.5 text-sm font-medium hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-60';

/** Daily backup switch, Back up now, and the list with Delete and Restore (server PC only). */
export function BackupSectionView({ enabled, savingEnabled, onEnabledChange, backups, listError, creating, onCreate, busyName, onDelete, onRestore, isLocalClient, actionError, restartPending }: BackupSectionViewProps) {
  const restoreReason = restoreDisabledReason(isLocalClient);
  return <section aria-labelledby="backups-heading" className="rounded-xl border border-border bg-surface p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 id="backups-heading" className="font-semibold">Backups</h2><p className="mt-1 text-sm text-muted">Copies of your library database: watch history, shelves and match choices.</p></div>
      <button type="button" onClick={onCreate} disabled={creating} className={buttonClass}>{creating ? 'Backing up…' : 'Back up now'}</button>
    </div>
    <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} disabled={savingEnabled} onChange={(event) => onEnabledChange(event.target.checked)} className="h-4 w-4" />Back up daily at 04:00</label>
    {restoreReason && <p className="mt-2 text-xs text-muted">{restoreReason}</p>}
    {restartPending && <p role="status" className="mt-3 rounded-lg border border-warning-border/50 bg-warning-soft p-3 text-sm text-warning">Restore scheduled. Restart OttLib to finish: the backup replaces the database when the server starts.</p>}
    {actionError && <p role="alert" className="mt-3 text-sm text-error">{actionError}</p>}
    {listError && <p role="alert" className="mt-3 text-sm text-error">{listError}</p>}
    {!backups && !listError && <p className="mt-3 text-sm text-muted">Loading backups…</p>}
    {backups && !backups.length && <p className="mt-3 text-sm text-muted">No backups yet.</p>}
    {backups && backups.length > 0 && <ul className="mt-4 space-y-2">
      {backups.map((backup) => <li key={backup.name} className="flex flex-col gap-2 rounded-lg bg-field px-3 py-2 text-sm md:flex-row md:items-center md:justify-between">
        <div className="min-w-0"><p className="font-medium">{backupKindLabels[backup.kind]}</p><p className="text-xs text-muted tabular-nums">{formatBackupDate(backup.createdAt)} · {formatBackupSize(backup.sizeBytes)}</p></div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => onRestore(backup)} disabled={Boolean(restoreReason) || busyName === backup.name} title={restoreReason ?? undefined} className={buttonClass}>Restore</button>
          <button type="button" onClick={() => onDelete(backup)} disabled={busyName === backup.name} className="rounded-lg border border-error-border px-3 py-1.5 text-sm font-medium text-error hover:bg-error-soft disabled:cursor-not-allowed disabled:opacity-60">Delete</button>
        </div>
      </li>)}
    </ul>}
  </section>;
}

export function BackupSettingsSection() {
  const settings = useSettings();
  const { update } = useSettingsActions();
  const { list, create, remove, restore } = useBackups();
  const isLocalClient = useIsLocalClient();
  if (!settings.data) return null;
  const actionError = [create.error && create.error.message, remove.error && remove.error.message, restore.error && restoreErrorMessage(restore.error), update.error?.message].find(Boolean) || undefined;
  const busyName = remove.isPending ? remove.variables : restore.isPending ? restore.variables : undefined;
  return <BackupSectionView
    enabled={settings.data.backupEnabled}
    savingEnabled={update.isPending}
    onEnabledChange={(backupEnabled) => update.mutate({ backupEnabled })}
    backups={list.data}
    listError={list.error?.message}
    creating={create.isPending}
    onCreate={() => create.mutate()}
    busyName={busyName}
    onDelete={(backup) => { if (window.confirm(`Delete this ${backupKindLabels[backup.kind].toLowerCase()} backup from ${formatBackupDate(backup.createdAt)}? It is removed permanently.`)) remove.mutate(backup.name); }}
    onRestore={(backup) => { if (window.confirm(`Restore the ${backupKindLabels[backup.kind].toLowerCase()} backup from ${formatBackupDate(backup.createdAt)}? It replaces your library database the next time OttLib starts; the current one is kept as a backup first.`)) restore.mutate(backup.name); }}
    isLocalClient={isLocalClient}
    actionError={actionError}
    restartPending={restore.isSuccess}
  />;
}
