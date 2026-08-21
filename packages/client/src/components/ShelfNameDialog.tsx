import { useEffect, useState } from 'react';
import { CloseIcon } from './icons';

interface ShelfNameDialogProps { open: boolean; name: string; saving?: boolean; onClose: () => void; onSave: (name: string) => void }

export function ShelfNameDialog({ open, name: initialName, saving, onClose, onSave }: ShelfNameDialogProps) {
  const [name, setName] = useState(initialName);
  useEffect(() => { if (open) setName(initialName); }, [open, initialName]);
  if (!open) return null;
  return <div className="fixed inset-0 z-40 flex items-center justify-center bg-overlay/80 p-4" role="dialog" aria-modal="true" aria-label="Rename shelf"><div className="w-full max-w-md rounded-2xl border border-border bg-surface shadow-2xl"><div className="flex items-center justify-between border-b border-border px-5 py-4"><h2 className="text-lg font-semibold">Rename shelf</h2><button type="button" onClick={onClose} className="rounded p-1 text-muted hover:text-foreground" aria-label="Close"><CloseIcon className="h-5 w-5" /></button></div><div className="p-5"><label className="block text-sm">Shelf name<input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={100} className="mt-1 w-full rounded-lg border border-border bg-field px-3 py-2" /></label></div><div className="flex justify-end gap-3 border-t border-border p-4"><button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-foreground/90 hover:bg-surface-raised">Cancel</button><button type="button" onClick={() => onSave(name.trim())} disabled={!name.trim() || saving} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover disabled:opacity-60">{saving ? 'Saving…' : 'Save name'}</button></div></div></div>;
}
