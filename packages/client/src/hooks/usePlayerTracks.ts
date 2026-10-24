import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PlaybackSource, SubtitleSource } from '@ottlib/shared';
import type { PlaybackSwitch } from '../utils/browserCaps';
import { waitForSubtitle } from '../utils/subtitleReadiness';
import type { SubtitleChoice, SubtitleStatus } from '../utils/trackMenuItems';

interface TracksOptions {
  video: HTMLVideoElement | null;
  source: PlaybackSource | null;
  /** Asks for a new playback answer at the current position (audio track or burned-in subtitle change). */
  reopen: (change: Omit<PlaybackSwitch, 'startMs'>) => void;
}

/**
 * Audio and subtitle selection. A text subtitle is a `<track>` the browser shows (instant); it is only rendered once its
 * URL answers 200, since an embedded track answers 202 while the server extracts it ("Preparing…"). An audio track or an
 * image subtitle (burned in) reopens the stream at the current position.
 */
export function usePlayerTracks({ video, source, reopen }: TracksOptions) {
  const [textUrl, setTextUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, SubtitleStatus | undefined>>({});
  const lastShown = useRef<SubtitleChoice | null>(null);
  const checks = useRef(new Map<string, AbortController>());

  const text = useMemo(() => source?.subtitles ?? [], [source]);
  const burnIn = useMemo(() => source?.burnInSubtitles ?? [], [source]);
  const audioTracks = useMemo(() => source?.audioTracks ?? [], [source]);
  const burning = source?.burnSubtitleOrder;
  const current: SubtitleChoice = burning !== undefined ? { kind: 'burn', order: burning } : textUrl ? { kind: 'text', url: textUrl } : { kind: 'off' };
  const readyTracks = useMemo<SubtitleSource[]>(() => text.filter((subtitle) => status[subtitle.url] === 'ready'), [text, status]);

  useEffect(() => () => { checks.current.forEach((controller) => controller.abort()); checks.current.clear(); }, []);

  // Show only the chosen text track; runs again when a track element appears or the video element is replaced.
  useEffect(() => {
    if (!video) return;
    video.querySelectorAll('track').forEach((element) => {
      element.track.mode = textUrl !== null && element.getAttribute('src') === textUrl ? 'showing' : 'disabled';
    });
  }, [video, textUrl, readyTracks]);

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
      .catch(() => { if (!controller.signal.aborted) setOne(url, 'failed'); })
      .finally(() => checks.current.delete(url));
  }, [status, setOne]);

  const selectSubtitle = useCallback((choice: SubtitleChoice) => {
    if (choice.kind !== 'off') lastShown.current = choice;
    const audioOrder = source?.audioOrder;
    if (choice.kind === 'burn') {
      setTextUrl(null);
      if (burning !== choice.order) reopen({ audioOrder, burnSubtitleOrder: choice.order });
      return;
    }
    if (choice.kind === 'text') showText(choice.url); else setTextUrl(null);
    if (burning !== undefined) reopen({ audioOrder });
  }, [source?.audioOrder, burning, reopen, showText]);

  const selectAudio = useCallback((order: number) => {
    if (order !== source?.audioOrder) reopen({ audioOrder: order, burnSubtitleOrder: burning });
  }, [source?.audioOrder, burning, reopen]);

  /** C key: hide what is shown, or bring back the last subtitle (else the first one offered). */
  const toggleSubtitles = useCallback(() => {
    if (current.kind !== 'off') { selectSubtitle({ kind: 'off' }); return; }
    const fallback: SubtitleChoice | null = text[0] ? { kind: 'text', url: text[0].url } : burnIn[0] ? { kind: 'burn', order: burnIn[0].order } : null;
    const next = lastShown.current ?? fallback;
    if (next) selectSubtitle(next);
  }, [current.kind, text, burnIn, selectSubtitle]);

  return { text, burnIn, audioTracks, status, current, readyTracks, selectSubtitle, selectAudio, toggleSubtitles };
}
