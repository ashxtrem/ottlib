import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ShelfMovieGrid } from '../components/ShelfMovieGrid';
import { ShelfNameDialog } from '../components/ShelfNameDialog';
import { ShelfSelectionDialog } from '../components/ShelfSelectionDialog';
import { useShelf, useShelfActions } from '../hooks/useShelves';

export function ShelfDetailPage() {
  const { id } = useParams(); const shelf = useShelf(id); const actions = useShelfActions(); const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false); const [renameOpen, setRenameOpen] = useState(false);
  if (shelf.isLoading) return <p className="text-muted">Loading shelf…</p>;
  if (!shelf.data) return <p className="text-error">Shelf not found.</p>;
  const item = shelf.data;
  const deleteShelf = () => { if (window.confirm(`Delete “${item.name}”? This will not delete any movie files.`)) actions.removeShelf.mutate(item.id, { onSuccess: () => navigate('/shelves') }); };
  return <section className="space-y-6"><Link to="/shelves" className="text-sm text-accent hover:underline">← Back to shelves</Link><div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-bold">{item.name}</h1><p className="mt-1 text-sm text-muted">{item.movieCount} title{item.movieCount === 1 ? '' : 's'} · drag cards to set your watch order</p></div><div className="flex flex-wrap gap-2"><button onClick={() => setAddOpen(true)} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover">Add titles</button><button onClick={() => setRenameOpen(true)} className="rounded-lg border border-border-strong px-4 py-2 text-sm hover:bg-surface-raised">Rename</button><button onClick={deleteShelf} disabled={actions.removeShelf.isPending} className="rounded-lg border border-error-border px-4 py-2 text-sm text-error hover:bg-error-soft/40">Delete</button></div></div>
    <ShelfMovieGrid movies={item.movies} busy={actions.removeMovie.isPending || actions.reorder.isPending} onRemove={(movieId) => actions.removeMovie.mutate({ id: item.id, movieId })} onReorder={(movieIds) => actions.reorder.mutate({ id: item.id, movieIds })} />
    <ShelfSelectionDialog open={addOpen} title={`Add titles to ${item.name}`} confirmLabel="Add titles" saving={actions.addMovies.isPending} onClose={() => setAddOpen(false)} onSave={({ movieIds }) => actions.addMovies.mutate({ id: item.id, movieIds }, { onSuccess: () => setAddOpen(false) })} />
    <ShelfNameDialog open={renameOpen} name={item.name} saving={actions.rename.isPending} onClose={() => setRenameOpen(false)} onSave={(name) => actions.rename.mutate({ id: item.id, name }, { onSuccess: () => setRenameOpen(false) })} />
  </section>;
}
