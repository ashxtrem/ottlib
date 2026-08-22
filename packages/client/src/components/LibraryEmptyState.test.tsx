import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import type { Folder, ScanRun } from '@ottlib/shared';
import { LibraryEmptyState } from './LibraryEmptyState';

const folder: Folder = { id: 1, path: 'E:/Movies', enabled: true, createdAt: '2026-01-01T00:00:00.000Z' };
const completedScan: ScanRun = { id: 1, status: 'completed', startedAt: '2026-01-01T00:00:00.000Z', finishedAt: '2026-01-01T00:01:00.000Z', filesFound: 4, filesProcessed: 4, errorSummary: null };

function render(props: Partial<ComponentProps<typeof LibraryEmptyState>> = {}) {
  return renderToStaticMarkup(<MemoryRouter><LibraryEmptyState folders={[]} scanHistory={[]} tmdbConfigured={false} filtersActive={false} scanning={false} onStartScan={vi.fn()} onClearFilters={vi.fn()} {...props} /></MemoryRouter>);
}

describe('LibraryEmptyState', () => {
  it('guides a fresh install to add its first folder', () => {
    const markup = render();
    expect(markup).toContain('Build your library');
    expect(markup).toContain('Add a folder');
  });

  it('offers a local clear action when filters hide every title', () => {
    const markup = render({ folders: [folder], scanHistory: [completedScan], tmdbConfigured: true, filtersActive: true });
    expect(markup).toContain('No titles match these filters');
    expect(markup).toContain('Clear filters');
  });

  it('reports the latest scan file count when setup is complete', () => {
    const markup = render({ folders: [folder], scanHistory: [completedScan], tmdbConfigured: true });
    expect(markup).toContain('No videos found yet');
    expect(markup).toContain('4 media files');
  });
});
