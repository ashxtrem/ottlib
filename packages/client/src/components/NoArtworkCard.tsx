import type { Movie } from '@ottlib/shared';

type NoArtworkStatus = Movie['metadataStatus'];

export function artworkTintFromTitle(title: string): number {
  let hash = 2_166_136_261;
  for (const character of title.trim().toLowerCase()) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0) % 360;
}

function stateLabel(status: NoArtworkStatus): string {
  if (status === 'suggested') return 'Needs review';
  return status === 'matched' ? 'Artwork unavailable' : 'Not matched';
}

function titleSize(title: string): string {
  if (title.length > 56) return 'text-base';
  if (title.length > 38) return 'text-lg';
  if (title.length > 24) return 'text-xl';
  return 'text-2xl';
}

export function NoArtworkCard({ title, year, status, className = '' }: { title: string; year: number | null; status: NoArtworkStatus; className?: string }) {
  const hue = artworkTintFromTitle(title);
  const accentHue = (hue + 44) % 360;
  const backgroundImage = `radial-gradient(circle at 90% 5%, hsl(${accentHue} 74% 62% / 0.38), transparent 36%), linear-gradient(145deg, hsl(${hue} 56% 36%), hsl(${accentHue} 58% 16%))`;
  return <div className={`relative flex h-full w-full overflow-hidden px-4 py-4 text-white ${className}`} style={{ backgroundImage }}>
    <div aria-hidden="true" className="absolute -bottom-10 -left-10 h-28 w-28 rounded-full border border-white/15" />
    <div aria-hidden="true" className="absolute -right-6 top-1/3 h-20 w-20 rounded-full border border-white/10" />
    <div className="relative flex w-full flex-col justify-between">
      <div className="flex min-h-0 flex-1 items-center"><h3 className={`max-h-[6.3em] overflow-hidden break-words font-display font-semibold leading-[1.05] tracking-tight text-white ${titleSize(title)}`}>{title}</h3></div>
      <div className="flex items-end justify-between gap-2"><span className="w-fit rounded-full border border-white/20 bg-black/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/90">{stateLabel(status)}</span><p className="text-sm font-medium tracking-wide text-white/75">{year ?? '—'}</p></div>
    </div>
  </div>;
}
