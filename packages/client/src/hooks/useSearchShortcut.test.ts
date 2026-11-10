import { describe, expect, it } from 'vitest';
import { isTextFieldTarget, searchShortcutAction } from './useSearchShortcut';

const key = (value: string, modifiers: { ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; shiftKey?: boolean } = {}) => ({ key: value, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...modifiers });
const body = { tagName: 'BODY' };

describe('search shortcut', () => {
  it('focuses the search on the library page and navigates there from other pages', () => {
    expect(searchShortcutAction(key('/'), body, '/library')).toBe('focus');
    expect(searchShortcutAction(key('/'), body, '/')).toBe('navigate');
    expect(searchShortcutAction(key('k', { ctrlKey: true }), body, '/')).toBe('navigate');
    expect(searchShortcutAction(key('K', { metaKey: true }), body, '/shelves')).toBe('navigate');
  });

  it('leaves other keys alone', () => {
    expect(searchShortcutAction(key('k'), body, '/')).toBeNull();
    expect(searchShortcutAction(key('/', { ctrlKey: true }), body, '/')).toBeNull();
    expect(searchShortcutAction(key('k', { ctrlKey: true, shiftKey: true }), body, '/')).toBeNull();
    expect(searchShortcutAction(key('a'), body, '/')).toBeNull();
  });

  it('never fires inside a text field', () => {
    for (const target of [{ tagName: 'INPUT' }, { tagName: 'TEXTAREA' }, { tagName: 'SELECT' }, { tagName: 'DIV', isContentEditable: true }]) {
      expect(isTextFieldTarget(target)).toBe(true);
      expect(searchShortcutAction(key('/'), target, '/library')).toBeNull();
      expect(searchShortcutAction(key('k', { ctrlKey: true }), target, '/')).toBeNull();
    }
    expect(isTextFieldTarget({ tagName: 'BUTTON' })).toBe(false);
  });
});
