import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ScheduleSettings } from './ScheduleSettings';

const callbacks = { onEnabledChange: vi.fn(), onPresetChange: vi.fn(), onCustomCronChange: vi.fn() };
const validSchedule = { data: { valid: true, nextRun: '2040-01-02T03:00:00.000Z' }, isFetching: false, isError: false } as never;

describe('ScheduleSettings', () => {
  it('leads with presets and keeps the cron field hidden outside Custom', () => {
    const markup = renderToStaticMarkup(<ScheduleSettings enabled preset="nightly" customCron="0 3 * * *" validation={validSchedule} {...callbacks} />);

    expect(markup).toContain('Every night');
    expect(markup).toContain('Twice daily');
    expect(markup).toContain('Weekly');
    expect(markup).toContain('Custom');
    expect(markup).toContain('Next scan');
    expect(markup).not.toContain('id="schedule-cron"');
  });

  it('shows the raw cron field only for a custom schedule', () => {
    const markup = renderToStaticMarkup(<ScheduleSettings enabled preset="custom" customCron="0 3 * * *" validation={validSchedule} {...callbacks} />);

    expect(markup).toContain('id="schedule-cron"');
    expect(markup).toContain('runs every day at 3:00 AM');
  });
});
