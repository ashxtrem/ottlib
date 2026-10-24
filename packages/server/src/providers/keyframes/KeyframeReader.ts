/** Reads the video keyframe times of a media file from its container index, without scanning the file. */
export interface KeyframeReader {
  name: string;
  /** Whether this reader handles the probed container label (e.g. 'MKV'). */
  supports(container: string): boolean;
  /** Keyframe times in ms for the first video track, ascending; null when the file has no usable index. */
  read(path: string): Promise<number[] | null>;
}
