import { useCallback, useEffect, useState } from 'react';

type IosVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void; webkitSupportsFullscreen?: boolean };

/**
 * Fullscreen for the player's container (so the custom controls stay on top). iOS Safari has no element fullscreen,
 * so there the `<video>` itself goes fullscreen with Safari's own controls (`<track>` subtitles still show).
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

  const toggle = useCallback(() => {
    if (document.fullscreenElement) { exit(); return; }
    if (container && document.fullscreenEnabled && container.requestFullscreen) { void container.requestFullscreen().catch(() => undefined); return; }
    const ios = video as IosVideo | null;
    if (ios?.webkitEnterFullscreen) ios.webkitEnterFullscreen();
  }, [container, video, exit]);

  return { fullscreen, toggle, exit };
}
