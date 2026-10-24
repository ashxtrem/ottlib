import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BackIcon } from '../components/icons';
import { focusRing } from '../components/interactionStyles';
import { PlaybackProblem } from '../components/player/PlaybackProblem';
import { PlayerControls, type PlayerMenu } from '../components/player/PlayerControls';
import { PlayerTapLayer } from '../components/player/PlayerTapLayer';
import { ResumeChip } from '../components/player/ResumeChip';
import { UpNextOverlay } from '../components/player/UpNextOverlay';
import { VideoSurface } from '../components/player/VideoSurface';
import { useAutoHide } from '../hooks/useAutoHide';
import { useFullscreen } from '../hooks/useFullscreen';
import { usePlaybackProgress } from '../hooks/usePlaybackProgress';
import { usePlaybackSource } from '../hooks/usePlaybackSource';
import { usePlayerCommands } from '../hooks/usePlayerCommands';
import { usePlayerShortcuts } from '../hooks/usePlayerShortcuts';
import { usePlayerTracks } from '../hooks/usePlayerTracks';
import { useUpNext } from '../hooks/useUpNext';
import { useVideoState } from '../hooks/useVideoState';
import { chooseHlsEngine, probeBrowserCaps, type PlaybackSwitch } from '../utils/browserCaps';
import { playbackProblem, type PlaybackFailure } from '../utils/playbackProblem';
import { SEEK_STEP_SECONDS, VOLUME_STEP } from '../utils/playerShortcuts';
import { audioItems, subtitleItems } from '../utils/trackMenuItems';

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
  // Up next replaces the URL: a fresh player per title, so no state (resume chip, tracks, countdown) carries over.
  return <WatchPlayer key={`${movieId}:${shelfId ?? ''}`} movieId={movieId} shelfId={shelfId} />;
}

function WatchPlayer({ movieId, shelfId }: { movieId: number; shelfId?: number }) {
  const caps = useMemo(() => probeBrowserCaps(), []);
  const hlsEngine = chooseHlsEngine(caps);
  const playback = usePlaybackSource(movieId, caps.request);
  const source = playback.source;
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [failure, setFailure] = useState<PlaybackFailure | null>(null);
  const [menu, setMenu] = useState<PlayerMenu>(null);
  // Set by an audio/burn-in switch: the reopened stream starts here instead of at the saved resume position.
  const [switchStartMs, setSwitchStartMs] = useState<number | null>(null);
  const [resumeAtMs, setResumeAtMs] = useState<number | null | undefined>(undefined);
  const leave = useLeaveWatch(movieId);
  usePlaybackProgress(video, { movieId, fallbackDurationMs: source?.durationMs ?? null, shelfId });
  const state = useVideoState(video, source?.durationMs ?? null);
  const commands = usePlayerCommands(video);
  const screen = useFullscreen(container, video);
  const controls = useAutoHide(state.paused || menu !== null);

  useEffect(() => setFailure(null), [source?.streamUrl]);
  useEffect(() => { if (source && resumeAtMs === undefined) setResumeAtMs(source.resumePositionMs ?? null); }, [source, resumeAtMs]);
  const problem = playbackProblem(playback.error, source, failure);
  const startMs = switchStartMs ?? source?.resumePositionMs ?? null;

  const { switchTo } = playback;
  const reopen = useCallback((change: Omit<PlaybackSwitch, 'startMs'>) => {
    const positionMs = video && video.readyState > 0 ? video.currentTime * 1000 : switchStartMs ?? source?.resumePositionMs ?? 0;
    setSwitchStartMs(positionMs);
    switchTo({ ...change, startMs: positionMs });
  }, [video, switchStartMs, source?.resumePositionMs, switchTo]);
  const tracks = usePlayerTracks({ video, source, reopen });

  // A session the server ended (e.g. reaped while paused) fails the hls stream: reopen once at the position before
  // showing the error. The once-flag resets as soon as playback runs again.
  const reopenedAfterFailure = useRef(false);
  useEffect(() => {
    if (!video) return;
    const onPlaying = () => { reopenedAfterFailure.current = false; };
    video.addEventListener('playing', onPlaying);
    return () => video.removeEventListener('playing', onPlaying);
  }, [video]);
  const onPlaybackError = useCallback((reason: PlaybackFailure) => {
    if (reason === 'media' && source?.kind === 'hls' && !reopenedAfterFailure.current) {
      reopenedAfterFailure.current = true;
      reopen({ audioOrder: source.audioOrder, burnSubtitleOrder: source.burnSubtitleOrder });
      return;
    }
    setFailure(reason);
  }, [source, reopen]);
  const upNext = useUpNext({ movieId, shelfId, positionMs: state.positionMs, durationMs: state.durationMs, ended: state.ended });

  usePlayerShortcuts({
    'toggle-play': commands.togglePlay,
    'seek-back': () => { commands.seekBy(-SEEK_STEP_SECONDS); controls.show(); },
    'seek-forward': () => { commands.seekBy(SEEK_STEP_SECONDS); controls.show(); },
    'volume-up': () => { commands.stepVolume(VOLUME_STEP); controls.show(); },
    'volume-down': () => { commands.stepVolume(-VOLUME_STEP); controls.show(); },
    fullscreen: screen.toggle,
    mute: commands.toggleMute,
    subtitles: tracks.toggleSubtitles,
    'exit-fullscreen': screen.exit,
    back: leave
  }, screen.fullscreen, menu === null && !problem);

  const phase = upNext.phase;
  return <div ref={setContainer} onPointerMove={controls.show} className={`fixed inset-0 z-50 h-[100dvh] w-screen overflow-hidden bg-black text-white ${controls.visible ? '' : 'cursor-none'}`}>
    {problem ? <PlaybackProblem movieId={movieId} message={problem} onBack={leave} />
      : source ? <>
        <VideoSurface source={source} hlsEngine={hlsEngine} startMs={startMs} textTracks={tracks.readyTracks} onVideoElement={setVideo} onPlaybackError={onPlaybackError} />
        <PlayerTapLayer onTogglePlay={commands.togglePlay} onToggleControls={controls.toggle} onSeekBy={commands.seekBy} />
        <PlayerControls
          state={state} visible={controls.visible} fullscreen={screen.fullscreen} onBack={leave}
          onTogglePlay={commands.togglePlay} onSeekBy={commands.seekBy} onSeekTo={commands.seekTo}
          onVolume={commands.setVolume} onToggleMute={commands.toggleMute} onToggleFullscreen={screen.toggle}
          audioItems={audioItems(tracks.audioTracks, source.audioOrder)} onSelectAudio={tracks.selectAudio}
          subtitleItems={subtitleItems({ text: tracks.text, burnIn: tracks.burnIn, status: tracks.status, current: tracks.current })} onSelectSubtitle={tracks.selectSubtitle}
          menu={menu} onMenu={setMenu}
        />
        {resumeAtMs && switchStartMs === null ? <ResumeChip positionMs={resumeAtMs} onStartOver={() => commands.seekTo(0)} /> : null}
        {upNext.next && (phase.kind === 'preview' || phase.kind === 'countdown') && <UpNextOverlay next={upNext.next} phase={phase} onPlayNow={upNext.playNow} onCancel={upNext.cancel} />}
      </>
        : <div className="flex h-full items-center justify-center" aria-live="polite"><svg aria-hidden="true" className="h-8 w-8 animate-spin text-white/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 12a8 8 0 1 1-2.34-5.66" /></svg><span className="sr-only">Loading…</span></div>}
    {!problem && !source && <button type="button" onClick={leave} aria-label="Back" title="Back" className={`absolute left-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 md:left-5 md:top-5 ${focusRing}`}><BackIcon /></button>}
  </div>;
}
