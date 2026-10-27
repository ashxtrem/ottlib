import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PlayerControls } from './PlayerControls';

const noop = () => undefined;
const state = { paused: false, ended: false, positionMs: 0, durationMs: 600_000, bufferedMs: 0, volume: 1, muted: false };

function render() {
  return renderToStaticMarkup(<PlayerControls
    state={state} visible fullscreen={false} onBack={noop} onTogglePlay={noop} onSeekBy={noop} onSeekTo={noop} onVolume={noop}
    onToggleMute={noop} onToggleFullscreen={noop} audioItems={[]} onSelectAudio={noop} subtitleItems={[]} onSelectSubtitle={noop}
    menu={null} onMenu={noop}
  />);
}

function buttonTag(markup: string, label: string): string {
  return markup.match(new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`))?.[0] ?? '';
}

describe('PlayerControls bottom row', () => {
  it('hides the mute button below sm (volume is hardware on phones) so the row fits at 320 px', () => {
    const mute = buttonTag(render(), 'Mute');
    expect(mute).toContain(' hidden ');
    expect(mute).toContain('sm:inline-flex');
  });

  it('keeps play, fullscreen and the time on phones', () => {
    const markup = render();
    expect(buttonTag(markup, 'Pause')).not.toContain(' hidden ');
    expect(buttonTag(markup, 'Fullscreen')).not.toContain(' hidden ');
    expect(markup).toContain('0:00');
  });

  it('keeps the plus and minus 10 s buttons for sm and up', () => {
    const markup = render();
    expect(buttonTag(markup, 'Back 10 seconds')).toContain('sm:inline-flex');
    expect(buttonTag(markup, 'Forward 10 seconds')).toContain('sm:inline-flex');
  });
});
