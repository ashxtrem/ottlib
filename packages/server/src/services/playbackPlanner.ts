import type { AudioTrackSource, BurnInSubtitle, MediaTrack, PlaybackMode, PlaybackRequest } from '@ottlib/shared';
import { MediaTrackRepository } from '../repositories/mediaTrackRepository.js';
import { MovieRepository, type PlaybackMovie, type ProbedMediaInfo } from '../repositories/movieRepository.js';
import { readKeyframes } from '../providers/keyframes/keyframeRegistry.js';
import { MediaInfoService } from './mediaInfoService.js';
import { audioTracksOf, decidePlayback, isImageSubtitle, type PlaybackDecision } from './playbackDecider.js';
import type { HlsSessionOpener } from './hls/sessionOpener.js';

/** What a capability request adds to the plain direct answer. */
export interface PlaybackPlan {
  mode: PlaybackMode;
  reasons: string[];
  audioTracks: AudioTrackSource[];
  audioOrder?: number;
  burnInSubtitles: BurnInSubtitle[];
  burnSubtitleOrder?: number;
  /** Set for remux/transcode: the HLS playlist and the URL that stops the session. */
  hls?: { playlistUrl: string; sessionUrl: string };
}

export interface PlaybackPlannerOptions {
  movies: MovieRepository;
  tracks: MediaTrackRepository;
  /** Probes a file that has not been probed yet. */
  mediaInfo: MediaInfoService;
  /** Opens remux/transcode sessions; without it (or without ffmpeg) every file plays directly. */
  sessions?: HlsSessionOpener;
  ffmpegAvailable?: () => Promise<boolean>;
  /** Reads keyframe times from the container index; defaults to the registered readers. */
  keyframes?: (path: string, container: string | null) => Promise<number[] | null>;
}

function audioSource(track: MediaTrack): AudioTrackSource {
  return { order: track.order, language: track.language, title: track.title, codec: track.codec, channels: track.channels, isDefault: track.isDefault };
}

/** Turns a playback request into a decision and, when the file cannot play as it is, an HLS session. */
export class PlaybackPlanner {
  public constructor(private readonly options: PlaybackPlannerOptions) {}

  public async plan(file: PlaybackMovie, profileId: number | undefined, request: PlaybackRequest, deviceId?: string): Promise<PlaybackPlan> {
    const info = await this.mediaInfoOf(file, profileId);
    if (!info) return this.describe('direct', ['probe-failed'], []);
    const tracks = this.options.tracks.listByMovieIds([file.id]).get(file.id) ?? [];
    const ffmpegAvailable = Boolean(this.options.sessions) && await (this.options.ffmpegAvailable?.() ?? Promise.resolve(false));
    // Assume a keyframe index exists first; it is only read (a file scan) when the answer could be remux.
    let keyframes: number[] | null = null;
    let decision = decidePlayback({ info, tracks, hasKeyframes: true, ffmpegAvailable, request });
    if (decision.mode === 'remux') {
      keyframes = await (this.options.keyframes ?? readKeyframes)(file.path, info.container).catch(() => null);
      if (!keyframes?.length) decision = decidePlayback({ info, tracks, hasKeyframes: false, ffmpegAvailable, request });
    }
    const plan = this.describe(decision.mode, decision.reasons, tracks, decision);
    if (decision.mode === 'direct') return plan;
    const audioChannels = tracks.find((track) => track.type === 'audio' && track.order === decision.audioOrder)?.channels ?? null;
    const handle = await this.options.sessions!.open({
      movie: file, mediaInfo: info, decision, deviceId, startMs: request.startMs, keyframesMs: decision.mode === 'remux' ? keyframes ?? [] : [], maxHeight: request.maxHeight, audioChannels
    });
    return { ...plan, hls: handle };
  }

  private describe(mode: PlaybackMode, reasons: string[], tracks: MediaTrack[], decision?: PlaybackDecision): PlaybackPlan {
    return {
      mode, reasons, audioTracks: audioTracksOf(tracks).map(audioSource),
      ...(decision?.audioOrder != null ? { audioOrder: decision.audioOrder } : {}),
      burnInSubtitles: tracks.filter((track) => track.source === 'embedded' && isImageSubtitle(track)).map((track) => ({
        order: track.order, language: track.language, title: track.title, codec: track.codec, isForced: track.isForced
      })),
      ...(decision?.burnSubtitleOrder != null ? { burnSubtitleOrder: decision.burnSubtitleOrder } : {})
    };
  }

  /** The file's probe result, running ffprobe once if it has none yet; null when the probe fails. */
  private async mediaInfoOf(file: PlaybackMovie, profileId: number | undefined): Promise<ProbedMediaInfo | null> {
    const known = this.options.movies.get(file.id, profileId)?.mediaInfo;
    if (known) return known;
    await this.options.mediaInfo.refresh(file.id, file.path);
    return this.options.movies.get(file.id, profileId)?.mediaInfo ?? null;
  }
}
