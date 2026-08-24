import { Modal } from './Modal';

interface MetadataRefreshDialogProps {
  open: boolean;
  title: string;
  count: number;
  running: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function MetadataRefreshDialog({ open, title, count, running, onClose, onConfirm }: MetadataRefreshDialogProps) {
  const titleLabel = count === 1 ? 'this title' : `${count} titles`;
  return <Modal open={open} title={title} subtitle={`Refresh metadata for ${titleLabel}.`} onClose={onClose} footer={<><button type="button" onClick={onClose} disabled={running} className="mr-auto rounded-lg px-4 py-2 text-sm text-muted hover:bg-surface-raised hover:text-foreground disabled:opacity-60">Cancel</button><button type="button" onClick={onConfirm} disabled={running} className="rounded-lg bg-warning px-4 py-2 text-sm font-medium text-warning-foreground hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60">{running ? 'Starting…' : 'Refresh metadata'}</button></>}>
    <div className="space-y-3 p-5 text-sm text-muted"><p>This rechecks the selected titles with your configured metadata providers. Their automatic title, year, artwork, and details may change.</p><p>Manual title overrides are kept. If no match is found, the library falls back to the filename-derived title. Provider errors leave existing metadata unchanged.</p><p className="font-medium text-foreground">This can take a while and uses provider requests.</p></div>
  </Modal>;
}
