import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MoreMenu } from './MoreMenu';
import { moreMenuItems } from '../../utils/moreMenuItems';

describe('moreMenuItems', () => {
  it('offers the mark at the current position, and Clear only for a mark', () => {
    const items = moreMenuItems({ positionMs: 1_400_000, credits: { startMs: 1_380_000, source: 'chapter' }, autoSkip: false, choice: null });
    expect(items[0]).toMatchObject({ label: 'Credits start here', detail: '23:20', action: true, command: { kind: 'mark' } });
    expect(items[1]).toMatchObject({ label: 'Clear credits mark', disabled: true });
    const marked = moreMenuItems({ positionMs: 0, credits: { startMs: 1_380_000, source: 'mark' }, autoSkip: false, choice: null });
    expect(marked[1]).toMatchObject({ disabled: false, detail: '23:00', command: { kind: 'clear-mark' } });
  });

  it('checks the override picked here, or points at the value in force while it is unknown', () => {
    const unknown = moreMenuItems({ positionMs: 0, credits: null, autoSkip: true, choice: null }).slice(2);
    expect(unknown.map(({ label, detail, selected }) => ({ label, detail, selected }))).toEqual([
      { label: 'Auto-skip credits: On', detail: 'current', selected: false },
      { label: 'Auto-skip credits: Off', detail: undefined, selected: false },
      { label: 'Auto-skip credits: Profile default', detail: undefined, selected: false }
    ]);
    const picked = moreMenuItems({ positionMs: 0, credits: null, autoSkip: true, choice: 'default' }).slice(2);
    expect(picked.map((item) => item.selected)).toEqual([false, false, true]);
    expect(picked[2].command).toEqual({ kind: 'auto-skip', choice: 'default' });
  });
});

describe('MoreMenu', () => {
  it('renders commands as plain items and the override as radio items', () => {
    const markup = renderToStaticMarkup(<MoreMenu open onOpenChange={() => undefined} onCommand={() => undefined} buttonClassName="" positionMs={0} credits={null} autoSkip={false} choice="off" />);
    expect(markup.match(/role="menuitem"/g)).toHaveLength(2);
    expect(markup.match(/role="menuitemradio"/g)).toHaveLength(3);
    expect(markup).toContain('aria-label="More"');
  });
});
