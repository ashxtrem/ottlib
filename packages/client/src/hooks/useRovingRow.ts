import { useEffect, useState, type FocusEvent, type KeyboardEvent, type RefObject } from 'react';

const focusableSelector = 'a[href], button, input, select, textarea, [tabindex]';
/** Marks the controls this hook took out of the tab order and holds their own tabindex ('' when they had none). */
const rovedAttribute = 'data-roved';
const nonTextInputTypes = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image']);

/** Where ←/→/Home/End move the row's tab stop; undefined for any other key. */
export function nextRovingIndex(key: string, index: number, count: number): number | undefined {
  if (count <= 0) return undefined;
  switch (key) {
    case 'ArrowRight': return Math.min(index + 1, count - 1);
    case 'ArrowLeft': return Math.max(index - 1, 0);
    case 'Home': return 0;
    case 'End': return count - 1;
    default: return undefined;
  }
}

/** True for a field that types text, where arrows and Home/End belong to the caret. */
export function isTextField(element: Element | null | undefined): boolean {
  if (!element) return false;
  if (element.tagName === 'TEXTAREA' || element.tagName === 'SELECT') return true;
  if (element.tagName === 'INPUT') return !nonTextInputTypes.has((element as HTMLInputElement).type);
  return (element as HTMLElement).isContentEditable === true;
}

/** Keeps the controls of the active item in the tab order and takes every other item's out. */
export function applyRovingTabStops(items: Element[], activeIndex: number): void {
  items.forEach((item, index) => item.querySelectorAll<HTMLElement>(focusableSelector).forEach((control) => {
    if (index === activeIndex) {
      if (!control.hasAttribute(rovedAttribute)) return;
      const original = control.getAttribute(rovedAttribute);
      if (original) control.setAttribute('tabindex', original); else control.removeAttribute('tabindex');
      control.removeAttribute(rovedAttribute);
    } else if (!control.hasAttribute(rovedAttribute)) {
      control.setAttribute(rovedAttribute, control.getAttribute('tabindex') ?? '');
      control.tabIndex = -1;
    }
  }));
}

/** One card per row holds the tab stop; ←/→, Home and End move it along the row. */
export function useRovingRow(listRef: RefObject<HTMLElement | null>, count: number) {
  const [active, setActive] = useState(0);
  const activeIndex = Math.min(active, Math.max(count - 1, 0));

  // Runs after every render so cards that re-render or arrive later are covered too.
  useEffect(() => {
    if (listRef.current) applyRovingTabStops(Array.from(listRef.current.children), activeIndex);
  });

  const indexOf = (target: EventTarget) => listRef.current ? Array.from(listRef.current.children).findIndex((item) => item.contains(target as Node)) : -1;

  const onFocus = (event: FocusEvent<HTMLElement>) => {
    const index = indexOf(event.target);
    if (index >= 0 && index !== activeIndex) setActive(index);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (isTextField(event.target as Element) || isTextField(document.activeElement)) return;
    const items = listRef.current ? Array.from(listRef.current.children) : [];
    const current = indexOf(event.target);
    const next = nextRovingIndex(event.key, current >= 0 ? current : activeIndex, items.length);
    if (next === undefined) return;
    event.preventDefault();
    setActive(next);
    items[next]?.querySelector<HTMLElement>(focusableSelector)?.focus();
  };

  return { activeIndex, onFocus, onKeyDown };
}
