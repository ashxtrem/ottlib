import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PlaybackSource, SubtitleSource } from '@ottlib/shared';
import type { PlaybackSwitch } from '../utils/browserCaps';
import { waitForSubtitle } from '../utils/subtitleReadiness';
import { pickSubtitle, rememberedStart, type TrackLanguages } from '../utils/trackMemory';
import type { SubtitleChoice, SubtitleStatus } from '../utils/trackMenuItems';
import { useNativeFullscreen } from './useNativeFullscreen';

interface TracksOptions {
  video: HTMLVideoElement | null;
  source: PlaybackSource | null;
  /** Asks for a new playback answer at the current position (audio track or burned-in subtitle change). */
  reopen: (change: Omit<PlaybackSwitch, 'startMs'>) => void;
  /** Asks again before playback has started (the remembered audio or burned-in subtitle), keeping the resume position. */
  restart: (change: PlaybackSwitch) => void;
  /** Languages to start with (useTrackMemory). */
  remembered: TrackLanguages;
  /** Called with the language of each pick the viewer makes. */
  onPick: (pick: TrackLanguages) => void;
}

/**
 * Audio and subtitle selection. A text subtitle is a `<track>` the browser shows (instant); it is only rendered once its
 * URL answers 200, since an embedded track answers 202 while the server extracts it ("Preparing…"). An audio track or an
 * image subtitle (burned in) reopens the stream at the current position. The first answer is steered to the remembered
 * languages once.
 */
export function usePlayerTracks({ video, source, reopen, restart, remembered, onPick }: TracksOptions) {
  const [textUrl, setTextUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, SubtitleStatus | undefined>>({});
  const lastShown = useRef<SubtitleChoice | null>(null);
  const checks = useRef(new Map<string, AbortController>());
  const startApplied = useRef(false);
  const nativeFullscreen = useNativeFullscreen(video);

  const text = useMemo(() => source?.subtitles ?? [], [source]);
  const burnIn = useMemo(() => source?.burnInSubtitles ?? [], [source]);
  const audioTracks = useMemo(() => source?.audioTracks ?? [], [source]);
  const burning = source?.burnSubtitleOrder;
  const current: SubtitleChoice = burning !== undefined ? { kind: 'burn', order: burning } : textUrl ? { kind: 'text', url: textUrl } : { kind: 'off' };
  const readyTracks = useMemo<SubtitleSource[]>(() => text.filter((subtitle) => status[subtitle.url] === 'ready'), [text, status]);

  useEffect(() => () => { checks.current.forEach((controller) => controller.abort()); checks.current.clear(); }, []);

  // Show only the chosen text track; runs again when a track element appears or the video element is replaced.
  // 'hidden': cues load and fire but the page draws them (CueOverlay) inside the visible box. In iOS native fullscreen the
  // page isn't on screen, so the browser draws the chosen track itself ('showing') until fullscreen ends.
  useEffect(() => {
    if (!video) return;
    video.querySelectorAll('track').forEach((element) => {
      const chosen = textUrl !== null && element.getAttribute('src') === textUrl;
      element.track.mode = chosen ? (nativeFullscreen ? 'showing' : 'hidden') : 'disabled';
    });
  }, [video, textUrl, readyTracks, nativeFullscreen]);

  const setOne = useCallback((url: string, value: SubtitleStatus) => setStatus((previous) => ({ ...previous, [url]: value })), []);

  const showText = useCallback((url: string) => {
    setTextUrl(url);
    if (status[url] === 'ready' || checks.current.has(url)) return;
    const controller = new AbortController();
    checks.current.set(url, controller);
    setOne(url, 'checking');
    waitForSubtitle(url, { signal: controller.signal, onPreparing: () => setOne(url, 'preparing') })
      .then((ready) => {
        setOne(url, ready ? 'ready' : 'failed');
        if (!ready) setTextUrl((wanted) => (wanted === url ? null : wanted));
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setOne(url, 'failed');
        setTextUrl((wanted) => (wanted === url ? null : wanted));
      })
      .finally(() => checks.current.delete(url));
  }, [status, setOne]);

  // The first answer: show the remembered text subtitle, or ask again for the remembered audio / burned-in subtitle.
  useEffect(() => {
    if (!source || startApplied.current) return;
    startApplied.current = true;
    const start = rememberedStart(source, remembered);
    if (start.text) { lastShown.current = { kind: 'text', url: start.text }; showText(start.text); }
    if (start.change) restart(start.change);
  }, [source, remembered, restart, showText]);

  const subtitleLanguage = useCallback((choice: SubtitleChoice): string | null | undefined => {
    if (choice.kind === 'off') return null;
    const language = choice.kind === 'text' ? text.find((subtitle) => subtitle.url === choice.url)?.language : burnIn.find((subtitle) => subtitle.order === choice.order)?.language;
    return language ?? undefined;
  }, [text, burnIn]);

  const selectSubtitle = useCallback((choice: SubtitleChoice) => {
    if (choice.kind !== 'off') lastShown.current = choice;
    onPick({ subtitle: subtitleLanguage(choice) });
    const audioOrder = source?.audioOrder;
    if (choice.kind === 'burn') {
      setTextUrl(null);
      if (burning !== choice.order) reopen({ audioOrder, burnSubtitleOrder: choice.order });
      return;
    }
    if (choice.kind === 'text') showText(choice.url); else setTextUrl(null);
    if (burning !== undefined) reopen({ audioOrder });
  }, [source?.audioOrder, burning, reopen, showText, onPick, subtitleLanguage]);

  /** A subtitle the finder just downloaded: show it, and reopen at the position so the new answer lists it. */
  const showDownloaded = useCallback((subtitle: SubtitleSource) => {
    lastShown.current = { kind: 'text', url: subtitle.url };
    onPick({ subtitle: subtitle.language ?? undefined });
    showText(subtitle.url);
    reopen({ audioOrder: source?.audioOrder });
  }, [source?.audioOrder, reopen, showText, onPick]);

  const selectAudio = useCallback((order: number) => {
    onPick({ audio: audioTracks.find((track) => track.order === order)?.language ?? undefined });
    if (order !== source?.audioOrder) reopen({ audioOrder: order, burnSubtitleOrder: burning });
  }, [source?.audioOrder, burning, reopen, audioTracks, onPick]);

  /** C key: hide what is shown, or bring back the last subtitle (else the remembered language, else the first one offered). */
  const toggleSubtitles = useCallback(() => {
    if (current.kind !== 'off') { selectSubtitle({ kind: 'off' }); return; }
    const fallback: SubtitleChoice | null = pickSubtitle(text, burnIn, remembered.subtitle)
      ?? (text[0] ? { kind: 'text', url: text[0].url } : burnIn[0] ? { kind: 'burn', order: burnIn[0].order } : null);
    const next = lastShown.current ?? fallback;
    if (next) selectSubtitle(next);
  }, [current.kind, text, burnIn, remembered.subtitle, selectSubtitle]);

  return { text, burnIn, audioTracks, status, current, readyTracks, selectSubtitle, selectAudio, toggleSubtitles, showDownloaded };
}
