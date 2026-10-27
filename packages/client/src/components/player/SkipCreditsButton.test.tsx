import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SkipCreditsButton, skipCreditsPlace } from './SkipCreditsButton';

describe('skipCreditsPlace', () => {
  it('raises "Skip credits" above up next\'s card while the card shows, else takes its place', () => {
    expect(skipCreditsPlace('skip', false)).toBe('bottom-28 md:bottom-32');
    expect(skipCreditsPlace('skip', true)).toBe(skipCreditsPlace('watch', true));
    expect(skipCreditsPlace('skip', true)).toContain('bottom-[16.5rem]');
  });

  it('always keeps "Watch credits" above the card', () => {
    expect(skipCreditsPlace('watch', false)).toBe(skipCreditsPlace('watch', true));
  });
});

describe('SkipCreditsButton', () => {
  it('renders "Skip credits" raised clear of the up-next preview card', () => {
    const markup = renderToStaticMarkup(<SkipCreditsButton kind="skip" aboveUpNext onPress={() => undefined} />);
    expect(markup).toContain('Skip credits');
    expect(markup).toContain('bottom-[16.5rem]');
    expect(markup).not.toContain('bottom-28');
  });
});
