import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CueOverlay, cueOverlayPlace } from './CueOverlay';

describe('cueOverlayPlace', () => {
  it('sits above the controls, and higher while the credits button or up next\'s card shows', () => {
    expect(cueOverlayPlace({ upNext: false, creditsButton: null })).toBe('bottom-20 md:bottom-24');
    expect(cueOverlayPlace({ upNext: false, creditsButton: 'low' })).toBe('bottom-[10.5rem] md:bottom-[11.5rem]');
    expect(cueOverlayPlace({ upNext: true, creditsButton: null })).toBe('bottom-[16rem] md:bottom-[17rem]');
    expect(cueOverlayPlace({ upNext: true, creditsButton: 'raised' })).toBe('bottom-[20rem] md:bottom-[20.5rem]');
    expect(cueOverlayPlace({ upNext: false, creditsButton: 'raised' })).toBe('bottom-[20rem] md:bottom-[20.5rem]');
  });

  it('draws nothing without lines and uses the lifted place', () => {
    expect(renderToStaticMarkup(<CueOverlay lines={[]} />)).toBe('');
    expect(renderToStaticMarkup(<CueOverlay lines={['Hello']} clearance={{ upNext: false, creditsButton: 'low' }} />)).toContain('bottom-[10.5rem]');
  });
});
