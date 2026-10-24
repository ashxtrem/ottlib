import { focusRing } from '../interactionStyles';

/** Centred error over the black watch page, with the VLC handoff (the `.m3u` playlist) and Back. */
export function PlaybackProblem({ movieId, message, onBack }: { movieId: number; message: string; onBack: () => void }) {
  return <div role="alert" className="flex h-full w-full flex-col items-center justify-center gap-5 px-6 text-center">
    <p className="max-w-md text-base text-white/90 md:text-lg">{message}</p>
    <div className="flex flex-wrap justify-center gap-3">
      <a href={`/api/stream/${movieId}/playlist.m3u`} className={`rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-white/85 ${focusRing}`}>Open in VLC</a>
      <button type="button" onClick={onBack} className={`rounded-lg border border-white/40 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10 ${focusRing}`}>Back</button>
    </div>
  </div>;
}
