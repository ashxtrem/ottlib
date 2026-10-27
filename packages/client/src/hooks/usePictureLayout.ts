import { useEffect, useMemo, useState, type RefObject } from 'react';
import type { PictureArea } from '@ottlib/shared';
import { pictureLayout, type FrameRect } from '../utils/pictureGeometry';
import type { PictureModeId } from '../utils/pictureModes';

interface Size { width: number; height: number }

const NO_SIZE: Size = { width: 0, height: 0 };

/**
 * Where the `<video>` goes inside its box for a picture mode: null until both sizes are known. The box is watched with a
 * ResizeObserver (window resize, fullscreen, phone rotation) and the video's own size is re-read when it loads or changes.
 */
export function usePictureLayout(box: HTMLElement | null, videoRef: RefObject<HTMLVideoElement | null>, area: PictureArea | null | undefined, mode: PictureModeId): FrameRect | null {
  const [boxSize, setBoxSize] = useState<Size>(NO_SIZE);
  const [videoSize, setVideoSize] = useState<Size>(NO_SIZE);

  useEffect(() => {
    if (!box) return;
    const measure = () => setBoxSize((prev) => (prev.width === box.clientWidth && prev.height === box.clientHeight ? prev : { width: box.clientWidth, height: box.clientHeight }));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [box]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const read = () => setVideoSize((prev) => (prev.width === video.videoWidth && prev.height === video.videoHeight ? prev : { width: video.videoWidth, height: video.videoHeight }));
    read();
    video.addEventListener('loadedmetadata', read);
    video.addEventListener('resize', read);
    return () => { video.removeEventListener('loadedmetadata', read); video.removeEventListener('resize', read); };
  }, [videoRef, box]);

  return useMemo(
    () => pictureLayout({ videoWidth: videoSize.width, videoHeight: videoSize.height, boxWidth: boxSize.width, boxHeight: boxSize.height, area, mode }),
    [videoSize, boxSize, area, mode]
  );
}
