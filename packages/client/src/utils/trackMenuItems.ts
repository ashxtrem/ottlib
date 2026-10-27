import type { AudioTrackSource, BurnInSubtitle, SubtitleSource } from '@ottlib/shared';

/** The subtitle the viewer picked: none, a text track shown by the browser, or an image track burned in by the server. */
export type SubtitleChoice = { kind: 'off' } | { kind: 'text'; url: string } | { kind: 'burn'; order: number };

/** Readiness of a text track: `preparing` while the server answers 202 (extracting), `failed` when it can't be loaded. */
export type SubtitleStatus = 'checking' | 'preparing' | 'ready' | 'failed';

export interface TrackMenuItem {
  key: string;
  label: string;
  /** Small text after the label (codec, "burned in", "Preparing…"). */
  detail?: string;
  selected: boolean;
  disabled?: boolean;
  /** A command (e.g. "Clear credits mark") rather than one choice of a set: a plain menu item, never checked. */
  action?: boolean;
}

const channelNames: Record<number, string> = { 1: 'Mono', 2: 'Stereo', 6: '5.1', 8: '7.1' };

function languageName(language: string | null): string | null {
  if (!language) return null;
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(language) ?? language;
  } catch {
    return language;
  }
}

function joinDetail(parts: Array<string | null | undefined | false>): string | undefined {
  const text = parts.filter((part): part is string => Boolean(part)).join(' · ');
  return text.length > 0 ? text : undefined;
}

export function audioItems(tracks: AudioTrackSource[], current: number | undefined): Array<TrackMenuItem & { order: number }> {
  const selectedOrder = current ?? tracks.find((track) => track.isDefault)?.order ?? tracks[0]?.order;
  return tracks.map((track, index) => ({
    key: `audio-${track.order}`,
    order: track.order,
    label: track.title ?? languageName(track.language) ?? `Track ${index + 1}`,
    detail: joinDetail([track.title ? languageName(track.language) : null, track.codec?.toUpperCase(), track.channels ? channelNames[track.channels] ?? `${track.channels} ch` : null]),
    selected: track.order === selectedOrder
  }));
}

export function subtitleKey(choice: SubtitleChoice): string {
  if (choice.kind === 'text') return `text-${choice.url}`;
  if (choice.kind === 'burn') return `burn-${choice.order}`;
  return 'off';
}

export interface SubtitleMenuInput {
  text: SubtitleSource[];
  burnIn: BurnInSubtitle[];
  status: Record<string, SubtitleStatus | undefined>;
  current: SubtitleChoice;
}

/** Off, the text tracks ("Preparing…" while extracting) and the image tracks marked "burned in". */
export function subtitleItems({ text, burnIn, status, current }: SubtitleMenuInput): Array<TrackMenuItem & { choice: SubtitleChoice }> {
  const currentKey = subtitleKey(current);
  const item = (choice: SubtitleChoice, label: string, detail?: string, disabled?: boolean) =>
    ({ key: subtitleKey(choice), choice, label, detail, disabled, selected: subtitleKey(choice) === currentKey });
  return [
    item({ kind: 'off' }, 'Off'),
    ...text.map((subtitle, index) => {
      const state = status[subtitle.url];
      const flags = [subtitle.isForced && 'Forced', subtitle.isHearingImpaired && 'SDH'];
      const detail = state === 'preparing' ? 'Preparing…' : state === 'failed' ? 'Unavailable' : joinDetail(flags);
      return item({ kind: 'text', url: subtitle.url }, subtitle.title ?? languageName(subtitle.language) ?? `Subtitles ${index + 1}`, detail, state === 'failed');
    }),
    ...burnIn.map((subtitle, index) =>
      item({ kind: 'burn', order: subtitle.order }, subtitle.title ?? languageName(subtitle.language) ?? `Subtitles ${text.length + index + 1}`, joinDetail([subtitle.isForced && 'Forced', 'burned in'])))
  ];
}
