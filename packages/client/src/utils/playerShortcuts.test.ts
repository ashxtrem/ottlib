import { describe, expect, it } from 'vitest';
import { doubleTapSeekSeconds, shortcutAction, stepVolume } from './playerShortcuts';

describe('shortcutAction', () => {
  it.each([
    [' ', 'toggle-play'], ['k', 'toggle-play'], ['K', 'toggle-play'],
    ['ArrowLeft', 'seek-back'], ['ArrowRight', 'seek-forward'],
    ['ArrowUp', 'volume-up'], ['ArrowDown', 'volume-down'],
    ['f', 'fullscreen'], ['F', 'fullscreen'], ['m', 'mute'], ['c', 'subtitles']
  ])('maps %j to %s', (key, action) => {
    expect(shortcutAction({ key }, false)).toBe(action);
  });

  it('Esc leaves fullscreen first, then goes back', () => {
    expect(shortcutAction({ key: 'Escape' }, true)).toBe('exit-fullscreen');
    expect(shortcutAction({ key: 'Escape' }, false)).toBe('back');
  });

  it('leaves unknown keys and browser shortcuts alone', () => {
    expect(shortcutAction({ key: 'x' }, false)).toBeNull();
    expect(shortcutAction({ key: 'f', ctrlKey: true }, false)).toBeNull();
    expect(shortcutAction({ key: 'ArrowLeft', metaKey: true }, false)).toBeNull();
    expect(shortcutAction({ key: 'k', altKey: true }, false)).toBeNull();
  });

  it('lets focused fields and sliders keep their keys, and buttons keep Space/Enter', () => {
    expect(shortcutAction({ key: 'ArrowLeft', targetTag: 'INPUT' }, false)).toBeNull();
    expect(shortcutAction({ key: 'Escape', targetTag: 'textarea' }, false)).toBeNull();
    expect(shortcutAction({ key: ' ', targetTag: 'BUTTON' }, false)).toBeNull();
    expect(shortcutAction({ key: 'Enter', targetTag: 'BUTTON' }, false)).toBeNull();
    expect(shortcutAction({ key: 'ArrowRight', targetTag: 'BUTTON' }, false)).toBe('seek-forward');
    expect(shortcutAction({ key: 'Escape', targetTag: 'BUTTON' }, false)).toBe('back');
  });

  it('lets a focused slider keep the arrows but not the other keys', () => {
    expect(shortcutAction({ key: 'ArrowLeft', targetTag: 'INPUT', targetType: 'range' }, false)).toBeNull();
    expect(shortcutAction({ key: ' ', targetTag: 'INPUT', targetType: 'range' }, false)).toBe('toggle-play');
    expect(shortcutAction({ key: 'f', targetTag: 'INPUT', targetType: 'range' }, false)).toBe('fullscreen');
    expect(shortcutAction({ key: 'k', targetTag: 'INPUT', targetType: 'text' }, false)).toBeNull();
  });
});

describe('stepVolume', () => {
  it('steps in tenths and stays within 0–1', () => {
    expect(stepVolume(0.5, 0.1)).toBe(0.6);
    expect(stepVolume(0.95, 0.1)).toBe(1);
    expect(stepVolume(0.05, -0.1)).toBe(0);
    expect(stepVolume(0.3, -0.1)).toBe(0.2);
  });
});

describe('doubleTapSeekSeconds', () => {
  it('seeks back on the left third, forward on the right third, nothing in the middle', () => {
    expect(doubleTapSeekSeconds(50, 300)).toBe(-10);
    expect(doubleTapSeekSeconds(150, 300)).toBe(0);
    expect(doubleTapSeekSeconds(250, 300)).toBe(10);
    expect(doubleTapSeekSeconds(10, 0)).toBe(0);
  });
});
