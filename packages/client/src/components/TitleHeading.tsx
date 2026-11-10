import type { Movie } from '@ottlib/shared';

type TitleHeadingProps = Pick<Movie, 'title' | 'year' | 'logoUrl'>;

/** The title page h1. A title logo replaces the text visually; the text stays in the h1 for screen readers. */
export function TitleHeading({ title, year, logoUrl }: TitleHeadingProps) {
  const query = `${title}${year ? ` ${year}` : ''}`;
  return <h1 className="flex flex-wrap items-center gap-2 text-3xl font-bold">
    {logoUrl
      ? <><span className="sr-only">{title}{year ? ` (${year})` : ''}</span><img src={logoUrl} alt="" aria-hidden="true" decoding="async" className="max-h-24 w-auto max-w-[min(100%,24rem)] object-contain object-left md:max-h-28" />{year && <span aria-hidden="true" className="text-xl font-semibold text-muted">({year})</span>}</>
      : <span>{title} {year && <span className="text-muted">({year})</span>}</span>}
    <a href={`https://www.google.com/search?q=${encodeURIComponent(query)}`} target="_blank" rel="noopener noreferrer" title="Search Google for this title" className="text-subtle hover:text-accent" aria-label="Search Google for this title">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
    </a>
  </h1>;
}
