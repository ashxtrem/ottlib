import { useCallback, useEffect, useState } from 'react';

type IosVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void; webkitSupportsFullscreen?: boolean };
type FullscreenDocument = Pick<Document, 'fullscreenElement' | 'fullscreenEnabled' | 'exitFullscreen'>;

/** Leaves fullscreen when on, else fullscreens the container (iOS has no element fullscreen: the video itself goes). */
export function toggleFullscreen(doc: FullscreenDocument, container: HTMLElement | null, video: HTMLVideoElement | null): void {
  if (doc.fullscreenElement) { void doc.exitFullscreen().catch(() => undefined); return; }
  if (container && doc.fullscreenEnabled && container.requestFullscreen) { void container.requestFullscreen().catch(() => undefined); return; }
  const ios = video as IosVideo | null;
  if (ios?.webkitEnterFullscreen) ios.webkitEnterFullscreen();
}

/**
 * Fullscreen for the player's container (so the custom controls stay on top). WatchPage owns the container above the
 * per-title key, so up next keeps fullscreen. iOS Safari has no element fullscreen, so there the `<video>` itself goes
 * fullscreen with Safari's own controls (`<track>` subtitles still show); that drops on the next title.
 */
export function useFullscreen(container: HTMLElement | null, video: HTMLVideoElement | null) {
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const exit = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  }, []);

  const toggle = useCallback(() => toggleFullscreen(document, container, video), [container, video]);

  return { fullscreen, toggle, exit };
}

export type FullscreenControls = ReturnType<typeof useFullscreen>;
