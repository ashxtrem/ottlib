import { BackIcon } from '../icons';
import { focusRing } from '../interactionStyles';
import { SeekBar } from './SeekBar';
import { TrackMenu } from './TrackMenu';
import { AudioGlyph, BackTenGlyph, ExitFullscreenGlyph, ForwardTenGlyph, FullscreenGlyph, MutedGlyph, PauseGlyph, PlayGlyph, SubtitlesGlyph, VolumeGlyph } from './playerIcons';
import type { VideoState } from '../../hooks/useVideoState';
import { formatClock } from '../../utils/playerTime';
import { SEEK_STEP_SECONDS } from '../../utils/playerShortcuts';
import type { SubtitleChoice, TrackMenuItem } from '../../utils/trackMenuItems';

export type PlayerMenu = 'audio' | 'subtitles' | null;

interface PlayerControlsProps {
  state: VideoState;
  visible: boolean;
  fullscreen: boolean;
  onBack: () => void;
  onTogglePlay: () => void;
  onSeekBy: (seconds: number) => void;
  onSeekTo: (ms: number) => void;
  onVolume: (volume: number) => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  audioItems: Array<TrackMenuItem & { order: number }>;
  onSelectAudio: (order: number) => void;
  subtitleItems: Array<TrackMenuItem & { choice: SubtitleChoice }>;
  onSelectSubtitle: (choice: SubtitleChoice) => void;
  menu: PlayerMenu;
  onMenu: (menu: PlayerMenu) => void;
}

/** Bigger touch targets at phone width, compact from `md:` up. */
const iconButton = 'inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white hover:bg-white/15 md:h-10 md:w-10';

/**
 * Play/pause, ±10 s, the seek bar with its buffered range, time, volume/mute, subtitles, audio, fullscreen and back.
 * Fades out when `visible` is false (the page hides it 3 s after the pointer stops while playing).
 */
export function PlayerControls(props: PlayerControlsProps) {
  const { state, visible, fullscreen, menu, onMenu } = props;
  const fade = `transition-opacity duration-base ${visible ? 'opacity-100' : 'pointer-events-none opacity-0'}`;
  const volumeLevel = state.muted ? 0 : state.volume;
  return <>
    <div className={`absolute inset-x-0 top-0 z-10 flex items-center gap-2 bg-gradient-to-b from-black/70 to-transparent p-3 md:p-5 ${fade}`}>
      <button type="button" onClick={props.onBack} aria-label="Back" title="Back" className={`${iconButton} bg-black/40 ${focusRing}`}><BackIcon /></button>
    </div>
    <div className={`absolute inset-x-0 bottom-0 z-10 flex flex-col gap-1 bg-gradient-to-t from-black/80 via-black/50 to-transparent px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-10 md:px-6 md:pb-4 ${fade}`}>
      <SeekBar positionMs={state.positionMs} durationMs={state.durationMs} bufferedMs={state.bufferedMs} onSeek={props.onSeekTo} />
      <div className="flex items-center gap-1 md:gap-2">
        <button type="button" onClick={props.onTogglePlay} aria-label={state.paused ? 'Play' : 'Pause'} title={state.paused ? 'Play (k)' : 'Pause (k)'} className={`${iconButton} ${focusRing}`}>{state.paused ? <PlayGlyph /> : <PauseGlyph />}</button>
        <button type="button" onClick={() => props.onSeekBy(-SEEK_STEP_SECONDS)} aria-label="Back 10 seconds" title="Back 10 s (←)" className={`${iconButton} hidden sm:inline-flex ${focusRing}`}><BackTenGlyph /></button>
        <button type="button" onClick={() => props.onSeekBy(SEEK_STEP_SECONDS)} aria-label="Forward 10 seconds" title="Forward 10 s (→)" className={`${iconButton} hidden sm:inline-flex ${focusRing}`}><ForwardTenGlyph /></button>
        <button type="button" onClick={props.onToggleMute} aria-label={state.muted ? 'Unmute' : 'Mute'} title={state.muted ? 'Unmute (m)' : 'Mute (m)'} className={`${iconButton} ${focusRing}`}>{volumeLevel === 0 ? <MutedGlyph /> : <VolumeGlyph />}</button>
        <input type="range" aria-label="Volume" min={0} max={1} step={0.05} value={volumeLevel} onChange={(event) => props.onVolume(Number(event.currentTarget.value))} className={`hidden h-1 w-24 cursor-pointer accent-white md:block ${focusRing}`} />
        <span className="ml-1 whitespace-nowrap text-xs tabular-nums text-white/80 md:text-sm">{formatClock(state.positionMs)} / {formatClock(state.durationMs)}</span>
        <span className="flex-1" />
        {props.subtitleItems.length > 1 && <TrackMenu label="Subtitles" icon={<SubtitlesGlyph />} items={props.subtitleItems} open={menu === 'subtitles'} onOpenChange={(open) => onMenu(open ? 'subtitles' : null)} onSelect={(item) => props.onSelectSubtitle(item.choice)} buttonClassName={iconButton} />}
        {props.audioItems.length > 1 && <TrackMenu label="Audio" icon={<AudioGlyph />} items={props.audioItems} open={menu === 'audio'} onOpenChange={(open) => onMenu(open ? 'audio' : null)} onSelect={(item) => props.onSelectAudio(item.order)} buttonClassName={iconButton} />}
        <button type="button" onClick={props.onToggleFullscreen} aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'} title={fullscreen ? 'Exit fullscreen (f)' : 'Fullscreen (f)'} className={`${iconButton} ${focusRing}`}>{fullscreen ? <ExitFullscreenGlyph /> : <FullscreenGlyph />}</button>
      </div>
    </div>
  </>;
}
