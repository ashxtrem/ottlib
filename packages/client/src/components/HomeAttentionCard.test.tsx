import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import type { HealthReport } from '@ottlib/shared';
import { describe, expect, it } from 'vitest';
import { attentionChecks } from '../utils/healthChecks';
import { HomeAttentionCardView } from './HomeAttentionCard';

const report = (...states: Array<'ok' | 'warn' | 'fail'>): HealthReport => ({
  checkedAt: '2026-11-10T10:00:00Z',
  checks: states.map((state, index) => ({ id: `check-${index}`, label: `Check ${index}`, state, message: `Message ${index}` }))
});
const render = (value: HealthReport | undefined) => renderToStaticMarkup(<MemoryRouter><HomeAttentionCardView checks={attentionChecks(value)} /></MemoryRouter>);

describe('HomeAttentionCard', () => {
  it('is hidden while loading and when every check is ok', () => {
    expect(render(undefined)).toBe('');
    expect(render(report('ok', 'ok'))).toBe('');
  });

  it('lists only warn and fail checks and links to Settings', () => {
    const markup = render(report('ok', 'warn', 'fail'));
    expect(markup).toContain('Needs attention');
    expect(markup).not.toContain('Message 0');
    expect(markup).toContain('Message 1');
    expect(markup).toContain('Message 2');
    expect(markup).toContain('href="/settings"');
  });

  it('shows for a single warning', () => {
    expect(render(report('warn'))).toContain('Check 0');
  });
});
