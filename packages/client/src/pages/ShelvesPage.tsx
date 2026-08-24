import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShelfCard } from '../components/ShelfCard';
import { ShelfSelectionDialog } from '../components/ShelfSelectionDialog';
import { useShelfActions, useShelves } from '../hooks/useShelves';
import { SkeletonShelfGrid } from '../components/Skeleton';

export function ShelvesPage() {
  const shelves = useShelves(); const actions = useShelfActions(); const [params] = useSearchParams(); const navigate = useNavigate();
  const createOpen = params.get('create') === '1';
  useEffect(() => { if (actions.create.isSuccess) navigate('/shelves', { replace: true }); }, [actions.create.isSuccess, navigate]);
  const close = () => navigate('/shelves', { replace: true });
  return <section><div className="mb-6"><h1 className="text-2xl font-bold">Shelves</h1><p className="mt-1 text-sm text-muted">Your hand-picked collections, shared across every device.</p></div>
    {shelves.isLoading && <SkeletonShelfGrid />}{shelves.error && <p className="text-error">{shelves.error.message}</p>}{shelves.data?.length === 0 && <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted">No shelves yet. Use the Create shelf button to add one.</div>}{shelves.data && <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{shelves.data.map((shelf, index) => <div key={shelf.id} className="animate-rise-in" style={{ animationDelay: `${index * 35}ms` }}><ShelfCard shelf={shelf} /></div>)}</div>}
    <ShelfSelectionDialog open={createOpen} title="Create shelf" confirmLabel="Create shelf" requireName saving={actions.create.isPending} onClose={close} onSave={({ name, movieIds }) => actions.create.mutate({ name, movieIds })} />
  </section>;
}
