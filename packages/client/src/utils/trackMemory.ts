import type { AudioTrackSource, BurnInSubtitle, PlaybackSource, SubtitleSource } from '@ottlib/shared';
import type { PlaybackSwitch } from './browserCaps';
import type { SubtitleChoice } from './trackMenuItems';

/**
 * Remembered languages (as the server reports them, e.g. `eng` or `en`). `subtitle: null` means subtitles were turned
 * off; an absent field means nothing is remembered for it.
 */
export interface TrackLanguages {
  audio?: string;
  subtitle?: string | null;
}

/** Per-title choices keyed by movie id. */
export type TrackChoices = Record<string, TrackLanguages>;

/** Oldest titles drop out past this many, so the stored value stays small. */
export const MAX_TRACK_CHOICES = 300;

const displayNames = (() => {
  try { return new Intl.DisplayNames(['en'], { type: 'language' }); } catch { return null; }
})();

/** One key for `eng`, `en` and `en-US` alike (by English language name); null for no or an undetermined language. */
export function languageKey(language: string | null | undefined): string | null {
  const base = language?.trim().toLowerCase().split(/[-_]/)[0];
  if (!base || base === 'und') return null;
  try { return displayNames?.of(base)?.toLowerCase() ?? base; } catch { return base; }
}

export function sameLanguage(a: string | null | undefined, b: string | null | undefined): boolean {
  const key = languageKey(a);
  return key !== null && key === languageKey(b);
}

function cleanLanguages(value: unknown): TrackLanguages | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { audio, subtitle } = value as Record<string, unknown>;
  const clean: TrackLanguages = {};
  if (typeof audio === 'string' && audio) clean.audio = audio;
  if (subtitle === null || (typeof subtitle === 'string' && subtitle)) clean.subtitle = subtitle;
  return clean;
}

function parseJson(raw: string | null): unknown {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function parseTrackChoices(raw: string | null): TrackChoices {
  const value = parseJson(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const choices: TrackChoices = {};
  for (const [movieId, entry] of Object.entries(value)) {
    const clean = cleanLanguages(entry);
    if (clean && /^\d+$/.test(movieId)) choices[movieId] = clean;
  }
  return choices;
}

export function parseTrackLanguages(raw: string | null): TrackLanguages {
  return cleanLanguages(parseJson(raw)) ?? {};
}

/** Per field: the title's own choice first, then the last-chosen languages on this device. */
export function rememberedLanguages(choices: TrackChoices, movieId: number, last: TrackLanguages): TrackLanguages {
  const own = choices[String(movieId)] ?? {};
  const merged: TrackLanguages = {};
  const audio = own.audio ?? last.audio;
  if (audio !== undefined) merged.audio = audio;
  const subtitle = own.subtitle !== undefined ? own.subtitle : last.subtitle;
  if (subtitle !== undefined) merged.subtitle = subtitle;
  return merged;
}

/**
 * Adds a pick to the title's entry. Past the cap the lowest movie ids (the titles added to the library first) drop out:
 * an object keyed by ids always lists them in numeric order, so it can't keep a most-recent order.
 */
export function recordTrackChoice(choices: TrackChoices, movieId: number, pick: TrackLanguages, max = MAX_TRACK_CHOICES): TrackChoices {
  const key = String(movieId);
  const next: TrackChoices = { ...choices, [key]: { ...choices[key], ...pick } };
  const ids = Object.keys(next).filter((id) => id !== key).sort((a, b) => Number(a) - Number(b));
  for (const id of ids.slice(0, Math.max(0, ids.length + 1 - max))) delete next[id];
  return next;
}

/** The audio track in the wanted language (the default one among several), or undefined to keep the server's pick. */
export function pickAudioOrder(tracks: AudioTrackSource[], language: string | undefined): number | undefined {
  if (!language) return undefined;
  const matches = tracks.filter((track) => sameLanguage(track.language, language));
  return (matches.find((track) => track.isDefault) ?? matches[0])?.order;
}

/** A full (not forced) track in the wanted language first, then a forced one. */
function bestByLanguage<T extends { language: string | null; isForced: boolean }>(tracks: T[], language: string): T | undefined {
  const matches = tracks.filter((track) => sameLanguage(track.language, language));
  return matches.find((track) => !track.isForced) ?? matches[0];
}

/** The subtitle in the wanted language: a text track first, else an image one (burned in); null keeps the default (off). */
export function pickSubtitle(text: SubtitleSource[], burnIn: BurnInSubtitle[], language: string | null | undefined): SubtitleChoice | null {
  if (!language) return null;
  const textTrack = bestByLanguage(text, language);
  if (textTrack) return { kind: 'text', url: textTrack.url };
  const image = bestByLanguage(burnIn, language);
  return image ? { kind: 'burn', order: image.order } : null;
}

export interface RememberedStart {
  /** A text subtitle to show right away. */
  text: string | null;
  /** Ask the server again for another audio track; null when its first answer already fits. */
  change: Omit<PlaybackSwitch, 'startMs'> | null;
}

/** What the first playback answer should become so the remembered languages play. Unknown languages change nothing. */
export function rememberedStart(source: PlaybackSource, wanted: TrackLanguages): RememberedStart {
  const tracks = source.audioTracks ?? [];
  const currentAudio = source.audioOrder ?? tracks.find((track) => track.isDefault)?.order ?? tracks[0]?.order;
  const audio = pickAudioOrder(tracks, wanted.audio);
  const subtitle = pickSubtitle(source.subtitles ?? [], source.burnInSubtitles ?? [], wanted.subtitle);
  const audioChanges = audio !== undefined && audio !== currentAudio;
  // Burn-in transcodes the video, so it stays an explicit menu pick (as on Android), never a remembered start.
  const change = audioChanges ? { audioOrder: audio } : null;
  return { text: subtitle?.kind === 'text' ? subtitle.url : null, change };
}
