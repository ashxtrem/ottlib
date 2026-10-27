import { useEffect, useState } from 'react';

type WebkitVideo = HTMLVideoElement & { webkitDisplayingFullscreen?: boolean };

/** True while iOS Safari shows the `<video>` itself fullscreen (webkitEnterFullscreen), where the page isn't drawn. */
export function useNativeFullscreen(video: HTMLVideoElement | null): boolean {
  const [native, setNative] = useState(false);

  useEffect(() => {
    if (!video) { setNative(false); return; }
    setNative(Boolean((video as WebkitVideo).webkitDisplayingFullscreen));
    const begin = () => setNative(true);
    const end = () => setNative(false);
    video.addEventListener('webkitbeginfullscreen', begin);
    video.addEventListener('webkitendfullscreen', end);
    return () => {
      video.removeEventListener('webkitbeginfullscreen', begin);
      video.removeEventListener('webkitendfullscreen', end);
    };
  }, [video]);

  return native;
}
