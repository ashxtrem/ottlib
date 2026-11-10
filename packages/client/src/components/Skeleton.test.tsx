import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DelayedSkeleton, SkeletonPosterGrid, StagedSkeleton } from './Skeleton';

describe('DelayedSkeleton', () => {
  it('renders nothing on the first paint, so a fast load shows no skeleton', () => {
    expect(renderToStaticMarkup(<DelayedSkeleton><SkeletonPosterGrid /></DelayedSkeleton>)).toBe('');
  });
});

describe('StagedSkeleton', () => {
  it('shows nothing while quiet', () => {
    expect(renderToStaticMarkup(<StagedSkeleton stage="quiet"><SkeletonPosterGrid /></StagedSkeleton>)).toBe('');
  });

  it('shows the skeleton without a reassurance line after 150 ms', () => {
    const markup = renderToStaticMarkup(<StagedSkeleton stage="skeleton"><SkeletonPosterGrid /></StagedSkeleton>);
    expect(markup).toContain('Loading titles…');
    expect(markup).not.toContain('Still loading…');
  });

  it('adds a "Still loading…" status line after 10 s', () => {
    const markup = renderToStaticMarkup(<StagedSkeleton stage="reassure"><SkeletonPosterGrid /></StagedSkeleton>);
    expect(markup).toContain('Loading titles…');
    expect(markup).toContain('role="status"');
    expect(markup).toContain('Still loading…');
  });
});
