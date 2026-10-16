import { formatBytes, formatResolution, type Movie } from '@ottlib/shared';
import { Modal } from './Modal';
import { focusRing } from './interactionStyles';

/** Asks before permanently deleting one copy's file. Cancel is the focused default so Enter never deletes. */
export function DeleteCopyDialog({ copy, otherCopies, deleting, onCancel, onConfirm }: { copy: Movie | null; otherCopies: number; deleting: boolean; onCancel: () => void; onConfirm: () => void }) {
  const details = copy ? [formatResolution(copy.mediaInfo?.height), copy.mediaInfo?.hdrFormat, formatBytes(copy.fileSizeBytes)].filter(Boolean).join(' · ') : '';
  return <Modal open={copy !== null} onClose={onCancel} title="Delete this copy from disk?" maxWidthClassName="max-w-lg"
    footer={<>
      <button type="button" autoFocus onClick={onCancel} disabled={deleting} className={`rounded-lg border border-border-strong px-4 py-2 text-sm font-medium hover:bg-surface-raised disabled:opacity-60 ${focusRing}`}>Cancel</button>
      <button type="button" onClick={onConfirm} disabled={deleting} className={`rounded-lg bg-error px-4 py-2 text-sm font-semibold text-error-solid-foreground hover:brightness-95 disabled:opacity-60 ${focusRing}`}>{deleting ? 'Deleting…' : 'Delete file permanently'}</button>
    </>}>
    {copy && <div className="space-y-4 p-5 text-sm">
      <p className="rounded-lg border border-error/40 bg-error/10 p-3 font-medium text-error">This permanently deletes the video file from your drive. It does not go to the Recycle Bin and cannot be undone.</p>
      <div className="space-y-1"><p className="break-words font-medium text-foreground">{copy.rawFilename}</p><p className="text-muted">{details}</p><p className="break-all font-mono text-xs text-muted">{copy.filePath}</p></div>
      <p className="text-muted">{otherCopies === 1 ? 'The other copy stays in your library.' : `The other ${otherCopies} copies stay in your library.`} Subtitle files beside the video are not touched.</p>
    </div>}
  </Modal>;
}
