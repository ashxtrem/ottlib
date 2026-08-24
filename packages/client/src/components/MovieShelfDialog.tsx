import { useEffect, useMemo, useState } from 'react';
import type { Movie, ShelfSummary } from '@ottlib/shared';
import { Modal } from './Modal';

interface MovieShelfDialogProps {
  open: boolean;
  movie: Movie;
  shelves: ShelfSummary[];
  saving?: boolean;
  onClose: () => void;
  onSave: (value: { shelfIds: number[]; newShelfName?: string }) => void;
}

export function MovieShelfDialog({ open, movie, shelves, saving, onClose, onSave }: MovieShelfDialogProps) {
  const initialIds = useMemo(() => movie.shelves.map((shelf) => shelf.id), [movie.shelves]);
  const [selectedIds, setSelectedIds] = useState(initialIds);
  const [newShelfName, setNewShelfName] = useState('');
  useEffect(() => {
    if (!open) return;
    setSelectedIds(initialIds);
    setNewShelfName('');
  }, [open, initialIds]);
  const selected = new Set(selectedIds);
  const toggle = (id: number) => setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);

  return <Modal open={open} title="Manage shelves" onClose={onClose} footer={<><button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-foreground/90 hover:bg-surface-raised">Cancel</button><button type="button" onClick={() => onSave({ shelfIds: selectedIds, newShelfName: newShelfName.trim() || undefined })} disabled={saving} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover disabled:opacity-60">{saving ? 'Saving…' : 'Save shelves'}</button></>}>
    <div className="space-y-4 p-5">
      <p className="text-sm text-muted">Choose where <span className="font-medium text-foreground">{movie.title}</span> belongs.</p>
      <div className="max-h-60 space-y-2 overflow-y-auto">{shelves.length ? shelves.map((shelf) => <label key={shelf.id} className="flex cursor-pointer items-center justify-between rounded-lg bg-field px-3 py-2 text-sm"><span className="flex items-center gap-3"><input type="checkbox" checked={selected.has(shelf.id)} onChange={() => toggle(shelf.id)} className="accent-accent" />{shelf.name}</span><span className="text-subtle">{shelf.movieCount}</span></label>) : <p className="text-sm text-muted">No shelves exist yet.</p>}</div>
      <label className="block text-sm">Or create a new shelf<input value={newShelfName} onChange={(event) => setNewShelfName(event.target.value)} maxLength={100} placeholder="New shelf name" className="mt-1 w-full rounded-lg border border-border bg-field px-3 py-2" /></label>
    </div>
  </Modal>;
}
