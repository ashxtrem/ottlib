import type { PlayMethod } from '@ottlib/shared';
import type { PlaybackHistoryRepository } from '../repositories/playbackHistoryRepository.js';
import type { PlaybackProgressRepository } from '../repositories/playbackProgressRepository.js';
import type { Viewer } from './viewer.js';

/** A progress save belongs to a play started at most this long ago; older plays are left as they ended. */
const sessionWindowMs = 12 * 60 * 60 * 1000;

export interface ProgressSaved {
  /** Where playback is now; null when the player only said it finished. */
  positionMs: number | null;
  /** Whether the save reached the watched threshold. */
  completed: boolean;
  /** The resume point before this save, used as the start of a play the client never announced. */
  resumedFromMs: number;
}

/** Play history per profile: a row per play, finished by the progress saves that follow it. */
export class PlaybackHistoryService {
  public constructor(private readonly history: PlaybackHistoryRepository, private readonly progress: PlaybackProgressRepository, private readonly now: () => Date = () => new Date()) {}

  /** Records a play handed off to a player; it starts from `positionMs`, else the profile's resume point. */
  public start(viewer: Viewer, movieId: number, method: PlayMethod, positionMs?: number): number {
    const startPositionMs = positionMs ?? this.progress.get(movieId, viewer.profileId)?.positionMs ?? 0;
    return this.history.start({ profileId: viewer.profileId, movieId, deviceId: viewer.deviceId, method, startPositionMs });
  }

  /**
   * Moves the play this progress belongs to: the latest open play from the last 12 h, else the latest one in that window
   * not yet watched to the end (a play earlier saves already finished). Without one, the save opens an `android_app` play,
   * since the Android app reports progress but does not announce plays yet.
   */
  public progressSaved(viewer: Viewer, movieId: number, saved: ProgressSaved): void {
    const now = this.now();
    const since = new Date(now.getTime() - sessionWindowMs).toISOString();
    const play = this.history.latestOpen(viewer.profileId, movieId, since) ?? this.history.latestIncomplete(viewer.profileId, movieId, since);
    const id = play?.id ?? this.history.start({ profileId: viewer.profileId, movieId, deviceId: viewer.deviceId, method: 'android_app', startPositionMs: saved.resumedFromMs });
    const endPositionMs = saved.positionMs ?? play?.endPositionMs ?? play?.startPositionMs ?? saved.resumedFromMs;
    this.history.finish(id, { endPositionMs, endedAt: now.toISOString(), completed: saved.completed });
  }
}
