import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BackIcon } from '../components/icons';
import { focusRing } from '../components/interactionStyles';
import { PlaybackProblem } from '../components/player/PlaybackProblem';
import { VideoSurface } from '../components/player/VideoSurface';
import { usePlaybackProgress } from '../hooks/usePlaybackProgress';
import { usePlaybackSource } from '../hooks/usePlaybackSource';
import { chooseHlsEngine, probeBrowserCaps } from '../utils/browserCaps';
import { playbackProblem, type PlaybackFailure } from '../utils/playbackProblem';

function positiveInt(value: string | null | undefined): number | undefined {
  const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

/** Back to where the viewer came from, or to the title's page when the player was opened directly. */
function useLeaveWatch(movieId: number): () => void {
  const navigate = useNavigate();
  return useCallback(() => {
    const index = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (index > 0) navigate(-1); else navigate(`/movie/${movieId}`, { replace: true });
  }, [movieId, navigate]);
}

/** Full-screen black player at /watch/:id (outside the header layout). `?shelf=` scopes progress to a shelf. */
export function WatchPage() {
  const movieId = positiveInt(useParams().id) ?? 0;
  const shelfId = positiveInt(useSearchParams()[0].get('shelf'));
  const caps = useMemo(() => probeBrowserCaps(), []);
  const hlsEngine = chooseHlsEngine(caps);
  const playback = usePlaybackSource(movieId, caps.request);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [failure, setFailure] = useState<PlaybackFailure | null>(null);
  const leave = useLeaveWatch(movieId);
  usePlaybackProgress(video, { movieId, fallbackDurationMs: playback.source?.durationMs ?? null, shelfId });

  const source = playback.source;
  useEffect(() => setFailure(null), [source?.streamUrl]);
  const problem = playbackProblem(playback.error, source, failure);
  // Resume hook for the "Resumed at · Start over" chip: start over = `video.currentTime = 0`.
  const startMs = source?.resumePositionMs ?? null;

  return <div className="fixed inset-0 z-50 h-[100dvh] w-screen overflow-hidden bg-black text-white">
    {problem ? <PlaybackProblem movieId={movieId} message={problem} onBack={leave} />
      : source ? <VideoSurface source={source} hlsEngine={hlsEngine} startMs={startMs} onVideoElement={setVideo} onPlaybackError={setFailure} />
        : <div className="flex h-full items-center justify-center" aria-live="polite"><svg aria-hidden="true" className="h-8 w-8 animate-spin text-white/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 12a8 8 0 1 1-2.34-5.66" /></svg><span className="sr-only">Loading…</span></div>}
    {!problem && <button type="button" onClick={leave} aria-label="Back" title="Back" className={`absolute left-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 md:left-5 md:top-5 ${focusRing}`}><BackIcon /></button>}
  </div>;
}
