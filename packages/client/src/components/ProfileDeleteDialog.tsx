import type { ProfileSummary } from '@ottlib/shared';
import { Modal } from './Modal';
import { focusRing } from './interactionStyles';

/** Asks before deleting a profile. Cancel is the focused default so Enter never deletes. */
export function ProfileDeleteDialog({ profile, deleting, error, onCancel, onConfirm }: { profile: ProfileSummary | null; deleting: boolean; error?: string | null; onCancel: () => void; onConfirm: () => void }) {
  return <Modal open={profile !== null} onClose={onCancel} title={profile ? `Delete ${profile.name}?` : 'Delete profile?'} maxWidthClassName="max-w-md"
    footer={<>
      <button type="button" autoFocus onClick={onCancel} disabled={deleting} className={`rounded-lg border border-border-strong px-4 py-2 text-sm font-medium hover:bg-surface-raised disabled:opacity-60 ${focusRing}`}>Cancel</button>
      <button type="button" onClick={onConfirm} disabled={deleting} className={`rounded-lg bg-error px-4 py-2 text-sm font-semibold text-error-solid-foreground hover:brightness-95 disabled:opacity-60 ${focusRing}`}>{deleting ? 'Deleting…' : 'Delete profile'}</button>
    </>}>
    <div className="space-y-3 p-5 text-sm">
      <p className="text-muted">This removes the profile with its watch progress, watched titles, hidden titles and play history. Movies, shelves and settings are not touched.</p>
      {error && <p role="alert" className="text-error">{error}</p>}
    </div>
  </Modal>;
}
