import { useEffect, useState } from 'react';
import { Modal } from './Modal';

interface ShelfNameDialogProps {
  open: boolean;
  name: string;
  saving?: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
}

export function ShelfNameDialog({ open, name: initialName, saving, onClose, onSave }: ShelfNameDialogProps) {
  const [name, setName] = useState(initialName);
  useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);
  return <Modal open={open} title="Rename shelf" onClose={onClose} maxWidthClassName="max-w-md" footer={<><button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-foreground/90 hover:bg-surface-raised">Cancel</button><button type="button" onClick={() => onSave(name.trim())} disabled={!name.trim() || saving} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover disabled:opacity-60">{saving ? 'Saving…' : 'Save name'}</button></>}>
    <div className="p-5"><label className="block text-sm">Shelf name<input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={100} className="mt-1 w-full rounded-lg border border-border bg-field px-3 py-2" /></label></div>
  </Modal>;
}
