import type { Movie } from '@ottlib/shared';
import { PosterCard } from './PosterCard';

export function PosterGrid({ movies }: { movies: Movie[] }) { return <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4">{movies.map((movie) => <PosterCard key={movie.id} movie={movie} />)}</div>; }
