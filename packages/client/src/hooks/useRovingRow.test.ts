import { describe, expect, it } from 'vitest';
import { applyRovingTabStops, isTextField, nextRovingIndex } from './useRovingRow';

class FakeControl {
  attributes = new Map<string, string>();
  get tabIndex() { return Number(this.attributes.get('tabindex') ?? 0); }
  set tabIndex(value: number) { this.attributes.set('tabindex', String(value)); }
  hasAttribute(name: string) { return this.attributes.has(name); }
  getAttribute(name: string) { return this.attributes.get(name) ?? null; }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  removeAttribute(name: string) { this.attributes.delete(name); }
}

/** A card with a poster link, a title link and the watched toggle. */
function card() {
  const controls = [new FakeControl(), new FakeControl(), new FakeControl()];
  return { controls, element: { querySelectorAll: () => controls } as unknown as Element };
}

const tabbable = (controls: FakeControl[]) => controls.map((control) => control.tabIndex >= 0);

describe('nextRovingIndex', () => {
  it('moves one card along the row and stops at the ends', () => {
    expect(nextRovingIndex('ArrowRight', 0, 5)).toBe(1);
    expect(nextRovingIndex('ArrowLeft', 3, 5)).toBe(2);
    expect(nextRovingIndex('ArrowRight', 4, 5)).toBe(4);
    expect(nextRovingIndex('ArrowLeft', 0, 5)).toBe(0);
  });

  it('jumps to the first and last card with Home and End', () => {
    expect(nextRovingIndex('Home', 3, 5)).toBe(0);
    expect(nextRovingIndex('End', 1, 5)).toBe(4);
  });

  it('ignores other keys and empty rows', () => {
    expect(nextRovingIndex('ArrowDown', 1, 5)).toBeUndefined();
    expect(nextRovingIndex('Tab', 1, 5)).toBeUndefined();
    expect(nextRovingIndex('ArrowRight', 0, 0)).toBeUndefined();
  });
});

describe('isTextField', () => {
  const input = (type: string) => ({ tagName: 'INPUT', type }) as unknown as Element;
  it('treats typing fields as text fields', () => {
    expect(isTextField(input('text'))).toBe(true);
    expect(isTextField(input('search'))).toBe(true);
    expect(isTextField({ tagName: 'TEXTAREA' } as unknown as Element)).toBe(true);
    expect(isTextField({ tagName: 'DIV', isContentEditable: true } as unknown as Element)).toBe(true);
  });

  it('leaves checkboxes, buttons and links to the row', () => {
    expect(isTextField(input('checkbox'))).toBe(false);
    expect(isTextField({ tagName: 'BUTTON' } as unknown as Element)).toBe(false);
    expect(isTextField({ tagName: 'A', isContentEditable: false } as unknown as Element)).toBe(false);
    expect(isTextField(null)).toBe(false);
  });
});

describe('applyRovingTabStops', () => {
  it('keeps every control of the active card in the tab order, including the watched toggle', () => {
    const cards = [card(), card(), card()];
    applyRovingTabStops(cards.map((c) => c.element), 1);
    expect(tabbable(cards[0]!.controls)).toEqual([false, false, false]);
    expect(tabbable(cards[1]!.controls)).toEqual([true, true, true]);
    expect(tabbable(cards[2]!.controls)).toEqual([false, false, false]);
  });

  it('hands the tab stop over when the active card changes', () => {
    const cards = [card(), card()];
    applyRovingTabStops(cards.map((c) => c.element), 0);
    applyRovingTabStops(cards.map((c) => c.element), 1);
    expect(tabbable(cards[0]!.controls)).toEqual([false, false, false]);
    expect(tabbable(cards[1]!.controls)).toEqual([true, true, true]);
    expect(cards[1]!.controls[0]!.hasAttribute('tabindex')).toBe(false);
  });

  it('leaves a tabindex it did not set alone', () => {
    const own = card();
    own.controls[0]!.tabIndex = 0;
    applyRovingTabStops([own.element], 0);
    expect(own.controls[0]!.hasAttribute('tabindex')).toBe(true);
  });

  it('gives a control its own tabindex back when its card becomes active again', () => {
    const cards = [card(), card()];
    cards[0]!.controls[2]!.setAttribute('tabindex', '0');
    applyRovingTabStops(cards.map((c) => c.element), 1);
    expect(tabbable(cards[0]!.controls)).toEqual([false, false, false]);
    applyRovingTabStops(cards.map((c) => c.element), 0);
    expect(cards[0]!.controls[2]!.getAttribute('tabindex')).toBe('0');
    expect(cards[0]!.controls[0]!.hasAttribute('tabindex')).toBe(false);
    expect(cards[0]!.controls[2]!.hasAttribute('data-roved')).toBe(false);
  });
});
