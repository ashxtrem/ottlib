import { useEffect, useState } from 'react';
import { frameTimeMs, frameUrl } from '../../utils/scrubTiming';

/** When the faded cover leaves the DOM: just after its `duration-base` (220 ms) fade. */
const FADE_MS = 300;

export interface StartCoverSource {
  framePreviewUrl: string;
  durationMs: number | null;
}

interface StartCoverProps {
  title: string | null;
  backdropUrl: string | null;
  /** Null until the playback source arrives. */
  source: StartCoverSource | null;
  /** Where playback starts (resume or a track switch); a frame is shown only above 0. */
  startMs: number | null;
  firstFrame: boolean;
}

type FrameLoad = 'loading' | 'shown' | 'failed';

/**
 * What the player shows until the video has a picture: the title's dimmed backdrop (it shares `title-backdrop` with the
 * title page, so the backdrop grows into the player), the title and a spinner. With a start position the frame there
 * replaces the backdrop once it loads; a missing frame (204, error) keeps the backdrop. Fades out on the first frame
 * (instantly under reduced motion) and comes back when the source changes (`firstFrame` false again).
 */
export function StartCover({ title, backdropUrl, source, startMs, firstFrame }: StartCoverProps) {
  const [gone, setGone] = useState(firstFrame);
  useEffect(() => {
    if (!firstFrame) { setGone(false); return; }
    const timer = window.setTimeout(() => setGone(true), FADE_MS);
    return () => window.clearTimeout(timer);
  }, [firstFrame]);

  const frame = source && startMs && startMs > 0 ? frameUrl(source.framePreviewUrl, frameTimeMs(startMs, source.durationMs)) : null;
  const [frameLoad, setFrameLoad] = useState<{ url: string | null; state: FrameLoad }>({ url: null, state: 'loading' });
  const frameState = frameLoad.url === frame ? frameLoad.state : 'loading';
  if (gone) return null;

  const frameShown = frame !== null && frameState === 'shown';
  return <div aria-hidden={firstFrame} className={`pointer-events-none absolute inset-0 z-0 overflow-hidden bg-black transition-opacity duration-base ease-standard motion-reduce:transition-none ${firstFrame ? 'opacity-0' : 'opacity-100'}`}>
    {backdropUrl && <img src={backdropUrl} alt="" className={`absolute inset-0 h-full w-full object-cover opacity-50 ${frameShown ? 'invisible' : ''}`} style={{ viewTransitionName: 'title-backdrop' }} />}
    {frame && frameState !== 'failed' && <img
      src={frame} alt="" decoding="async"
      className={`absolute inset-0 h-full w-full object-contain ${frameShown ? '' : 'opacity-0'}`}
      onLoad={(event) => setFrameLoad({ url: frame, state: event.currentTarget.naturalWidth > 0 ? 'shown' : 'failed' })}
      onError={() => setFrameLoad({ url: frame, state: 'failed' })}
    />}
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-t from-black/70 via-transparent to-black/40 px-6 text-center" aria-live="polite">
      {title && <p className="max-w-3xl text-xl font-semibold text-white drop-shadow md:text-3xl">{title}</p>}
      <svg aria-hidden="true" className="h-8 w-8 animate-spin text-white/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 12a8 8 0 1 1-2.34-5.66" /></svg>
      <span className="sr-only">Loading…</span>
    </div>
  </div>;
}
