import { describe, expect, it, vi } from 'vitest';
import { toggleFullscreen } from './useFullscreen';

function fakeDoc(fullscreenElement: unknown = null, fullscreenEnabled = true) {
  const exitFullscreen = vi.fn(() => Promise.resolve());
  return { doc: { fullscreenElement, fullscreenEnabled, exitFullscreen } as unknown as Document, exitFullscreen };
}
const fakeContainer = () => { const requestFullscreen = vi.fn(() => Promise.resolve()); return { el: { requestFullscreen } as unknown as HTMLElement, requestFullscreen }; };
const fakeVideo = () => { const webkitEnterFullscreen = vi.fn(); return { el: { webkitEnterFullscreen } as unknown as HTMLVideoElement, webkitEnterFullscreen }; };

describe('toggleFullscreen', () => {
  it('requests fullscreen on the container, not the video', () => {
    const { doc } = fakeDoc(); const container = fakeContainer(); const video = fakeVideo();
    toggleFullscreen(doc, container.el, video.el);
    expect(container.requestFullscreen).toHaveBeenCalledOnce();
    expect(video.webkitEnterFullscreen).not.toHaveBeenCalled();
  });

  it('exits when already fullscreen', () => {
    const { doc, exitFullscreen } = fakeDoc({}); const container = fakeContainer();
    toggleFullscreen(doc, container.el, null);
    expect(exitFullscreen).toHaveBeenCalledOnce();
    expect(container.requestFullscreen).not.toHaveBeenCalled();
  });

  it('falls back to the current video on iOS, where element fullscreen is unavailable', () => {
    const { doc } = fakeDoc(null, false); const video = fakeVideo();
    toggleFullscreen(doc, fakeContainer().el, video.el);
    expect(video.webkitEnterFullscreen).toHaveBeenCalledOnce();
  });

  it('does nothing without a target', () => {
    expect(() => toggleFullscreen(fakeDoc(null, false).doc, null, null)).not.toThrow();
  });
});
