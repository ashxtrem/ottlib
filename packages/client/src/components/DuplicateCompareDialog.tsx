import { formatBytes, formatMediaLanguage, formatResolution, formatRuntime, type MediaTrack, type Movie } from '@ottlib/shared';
import type { ReactNode } from 'react';
import { Modal } from './Modal';
import { RevealInFolderButton } from './RevealInFolderButton';

function valueOrDash(value: string | number | null | undefined): string | number { return value ?? '—'; }

function trackDetails(track: MediaTrack): string {
  const channels = track.channelLayout ?? (track.channels ? `${track.channels}.0` : null);
  return [formatMediaLanguage(track.language), track.codec, channels, track.title, track.source === 'external' ? 'External' : null, track.isDefault ? 'Default' : null, track.isForced ? 'Forced' : null, track.isHearingImpaired ? 'SDH' : null].filter(Boolean).join(' · ');
}

function tracksFor(movie: Movie, type: MediaTrack['type']): string[] {
  return movie.mediaInfo?.tracks.filter((track) => track.type === type).map(trackDetails) ?? [];
}

function TrackCell({ tracks }: { tracks: string[] }) {
  return tracks.length ? <ul className="space-y-1 text-xs leading-5">{tracks.map((track, index) => <li key={`${track}-${index}`}>{track}</li>)}</ul> : <span>—</span>;
}

function ComparisonRow({ label, movies, children }: { label: string; movies: Movie[]; children: (movie: Movie) => ReactNode }) {
  return <tr className="border-t border-border align-top"><th scope="row" className="sticky left-0 z-10 w-32 bg-surface-raised p-3 text-left text-xs font-semibold uppercase tracking-wide text-subtle">{label}</th>{movies.map((movie) => <td key={movie.id} className="min-w-52 p-3 text-sm text-foreground">{children(movie)}</td>)}</tr>;
}

export function DuplicateCompareDialog({ open, onClose, primary, duplicates }: { open: boolean; onClose: () => void; primary: Movie; duplicates: Movie[] }) {
  const movies = [primary, ...duplicates.slice().sort((left, right) => (right.mediaInfo?.height ?? -1) - (left.mediaInfo?.height ?? -1) || left.id - right.id)];
  return <Modal open={open} onClose={onClose} title="Compare copies" subtitle="Technical details for the copies in your library." maxWidthClassName="max-w-4xl" footer={<button type="button" onClick={onClose} className="rounded-lg border border-border-strong px-4 py-2 text-sm font-medium hover:bg-surface-raised">Close</button>}>
    <div className="min-h-0 flex-1 overflow-y-auto p-5">
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[900px] text-left">
          <thead className="bg-surface-raised"><tr><th className="sticky left-0 z-10 w-32 bg-surface-raised p-3 text-xs font-semibold uppercase tracking-wide text-subtle">Detail</th>{movies.map((movie, index) => <th key={movie.id} className="min-w-52 p-3 text-left"><p className="text-xs font-semibold uppercase tracking-wide text-subtle">{index === 0 ? 'This copy' : `Copy ${index + 1}`}</p><p className="mt-1 break-words text-sm font-medium text-foreground">{movie.rawFilename}</p></th>)}</tr></thead>
          <tbody>
            <ComparisonRow label="Resolution" movies={movies}>{(movie) => valueOrDash(formatResolution(movie.mediaInfo?.height))}</ComparisonRow>
            <ComparisonRow label="HDR format" movies={movies}>{(movie) => valueOrDash(movie.mediaInfo?.hdrFormat)}</ComparisonRow>
            <ComparisonRow label="Video codec" movies={movies}>{(movie) => [movie.mediaInfo?.videoCodec, movie.mediaInfo?.videoProfile].filter(Boolean).join(' · ') || '—'}</ComparisonRow>
            <ComparisonRow label="Bitrate" movies={movies}>{(movie) => movie.mediaInfo?.videoBitRate ? `${Math.round(movie.mediaInfo.videoBitRate / 1_000_000 * 10) / 10} Mbps` : '—'}</ComparisonRow>
            <ComparisonRow label="Container" movies={movies}>{(movie) => valueOrDash(movie.mediaInfo?.container)}</ComparisonRow>
            <ComparisonRow label="Runtime" movies={movies}>{(movie) => valueOrDash(formatRuntime(movie.runtime, movie.mediaInfo?.durationMs))}</ComparisonRow>
            <ComparisonRow label="File size" movies={movies}>{(movie) => formatBytes(movie.fileSizeBytes)}</ComparisonRow>
            <ComparisonRow label="Audio tracks" movies={movies}>{(movie) => <TrackCell tracks={tracksFor(movie, 'audio')} />}</ComparisonRow>
            <ComparisonRow label="Subtitle tracks" movies={movies}>{(movie) => <TrackCell tracks={tracksFor(movie, 'subtitle')} />}</ComparisonRow>
            <ComparisonRow label="Watched" movies={movies}>{(movie) => movie.watched ? 'Watched' : 'Unwatched'}</ComparisonRow>
            <ComparisonRow label="Added" movies={movies}>{(movie) => new Date(movie.addedAt).toLocaleDateString()}</ComparisonRow>
            <ComparisonRow label="Availability" movies={movies}>{(movie) => movie.missing ? 'Missing' : 'Available'}</ComparisonRow>
            <ComparisonRow label="File path" movies={movies}>{(movie) => <div className="flex items-start gap-2"><span className="min-w-0 break-all font-mono text-xs leading-5 text-muted">{movie.filePath}</span><RevealInFolderButton movieId={movie.id} /></div>}</ComparisonRow>
          </tbody>
        </table>
      </div>
    </div>
  </Modal>;
}
