import { useEffect, useState } from 'react';
import { cuesToLines } from '../utils/cueLines';

/**
 * The lines of the cues showing now on the video's hidden text track. The browser would lay native cues out inside the
 * `<video>` box, which can reach past the visible player box (Zoom, Smart fill, Stretch), so the track is kept `hidden`
 * (loaded, fires `cuechange`, draws nothing) and the page draws the lines itself. At most one of our tracks is `hidden`
 * at a time (none in iOS native fullscreen, where the browser shows it).
 */
export function useActiveCues(video: HTMLVideoElement | null): string[] {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    if (!video) { setLines([]); return; }
    const list = video.textTracks;
    let bound: TextTrack | null = null;
    const update = () => {
      const cues = bound?.activeCues;
      const next = cues ? cuesToLines(Array.from(cues) as Array<TextTrackCue & { text?: string }>) : [];
      setLines((previous) => (previous.length === next.length && previous.every((line, i) => line === next[i]) ? previous : next));
    };
    const bind = () => {
      // Only a track of our own `<track>` elements: Safari's native HLS can add in-band caption tracks that are hidden too.
      const ours = Array.from(video.querySelectorAll('track'), (element) => element.track);
      const hidden = ours.find((track) => track.mode === 'hidden') ?? null;
      if (hidden === bound) return;
      bound?.removeEventListener('cuechange', update);
      bound = hidden;
      bound?.addEventListener('cuechange', update);
      update();
    };
    bind();
    list.addEventListener('change', bind);
    list.addEventListener('addtrack', bind);
    list.addEventListener('removetrack', bind);
    return () => {
      list.removeEventListener('change', bind);
      list.removeEventListener('addtrack', bind);
      list.removeEventListener('removetrack', bind);
      bound?.removeEventListener('cuechange', update);
    };
  }, [video]);

  return lines;
}
