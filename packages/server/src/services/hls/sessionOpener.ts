import type { PlaybackMovie, ProbedMediaInfo } from '../../repositories/movieRepository.js';
import type { PlaybackDecision } from '../playbackDecider.js';

export interface HlsSessionInput {
  movie: PlaybackMovie;
  /** The probe result of the file, for the encoder (source codec, size). */
  mediaInfo: ProbedMediaInfo;
  /** `remux` or `transcode`. */
  decision: PlaybackDecision;
  deviceId?: string;
  /** Where the viewer starts; 0 when absent. */
  startMs?: number;
  /** Keyframe times (ms) for a remux; empty for a transcode. */
  keyframesMs: number[];
  /** The client's `maxHeight` cap, when it sent one. */
  maxHeight?: number;
}

export interface HlsSessionHandle {
  /** Server-relative URL of the HLS playlist. */
  playlistUrl: string;
  /** Server-relative URL the client DELETEs to stop the session. */
  sessionUrl: string;
}

/** What the playback answer needs from the HLS session service (built separately): open a session for a decided file. */
export interface HlsSessionOpener {
  open(input: HlsSessionInput): Promise<HlsSessionHandle>;
}

/** All transcode slots are taken; the route answers 503 `TRANSCODE_BUSY`. */
export class SessionBusyError extends Error {
  public readonly code = 'TRANSCODE_BUSY';
  public constructor(message = 'All transcode sessions are busy') { super(message); this.name = 'SessionBusyError'; }
}
