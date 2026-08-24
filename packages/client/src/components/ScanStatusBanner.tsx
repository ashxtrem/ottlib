import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, type ReactNode } from 'react';
import type { ScanRun } from '@ottlib/shared';
import { useScanStatus } from '../hooks/useScanStatus';
import { useAutoAcceptBackfillRunStatus } from '../hooks/useSettings';
import { useMetadataRefresh } from '../hooks/useMetadataRefresh';
import { useToast } from '../hooks/useToast';

function firstErrorLine(errorSummary: string | null): string {
  return errorSummary?.split(/\r?\n/, 1)[0]?.trim() || 'Check Recent scans for details.';
}

function ProgressRail({ current, total, tone = 'accent' }: { current: number; total: number; tone?: 'accent' | 'warning' }) {
  const value = total > 0 ? Math.min(100, Math.max(0, (current / total) * 100)) : 0;
  return <div className="absolute inset-x-0 bottom-0 h-0.5 bg-black/10" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.min(current, total)} aria-label="Job progress"><div className={`h-full origin-left transition-transform duration-[1200ms] ease-linear ${tone === 'warning' ? 'bg-warning' : 'bg-accent'}`} style={{ transform: `scaleX(${value / 100})` }} /></div>;
}

function CollapsibleBanner({ open, children }: { open: boolean; children: ReactNode }) {
  return <div className={`grid transition-[grid-template-rows] duration-slow ease-standard ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}><div className="min-h-0 overflow-hidden"><div aria-hidden={!open} className={open ? 'animate-rise-in' : ''}>{children}</div></div></div>;
}

export function ScanStatusBanner() {
  const { data } = useScanStatus(); const autoAccept = useAutoAcceptBackfillRunStatus(); const metadataRefresh = useMetadataRefresh(); const client = useQueryClient();
  const { show } = useToast(); const previousStatus = useRef<'idle' | 'running' | 'completed' | 'failed' | undefined>(undefined);
  const previousAutoAcceptStatus = useRef<'idle' | 'running' | 'completed' | 'failed' | undefined>(undefined);
  const previousMetadataRefreshStatus = useRef<'idle' | 'running' | 'completed' | 'failed' | undefined>(undefined);
  useEffect(() => {
    if (previousStatus.current === 'running' && data?.status === 'failed') show(`Scan failed — ${firstErrorLine(data.errorSummary)}`, 'error');
    if (previousStatus.current === 'running' && data?.status === 'completed') show(`Scan finished — ${data.titlesAdded} new ${data.titlesAdded === 1 ? 'title' : 'titles'}.`, 'success');
    previousStatus.current = data?.status;
  }, [data, show]);
  useEffect(() => {
    if (previousAutoAcceptStatus.current === 'running' && autoAccept.data?.status === 'completed') {
      const result = `Accepted ${autoAccept.data.titlesAdded} ${autoAccept.data.titlesAdded === 1 ? 'match' : 'matches'}.`;
      show(autoAccept.data.errorSummary ? `${result} ${firstErrorLine(autoAccept.data.errorSummary)}` : result, autoAccept.data.errorSummary ? 'info' : 'success');
    }
    if (previousAutoAcceptStatus.current === 'running' && autoAccept.data?.status === 'failed') show(`Accepting matches failed — ${firstErrorLine(autoAccept.data.errorSummary)}`, 'error');
    previousAutoAcceptStatus.current = autoAccept.data?.status;
  }, [autoAccept.data, show]);
  useEffect(() => {
    if (previousMetadataRefreshStatus.current === 'running' && metadataRefresh.status.data?.status === 'completed') {
      const result = `Refreshed ${metadataRefresh.status.data.titlesAdded} ${metadataRefresh.status.data.titlesAdded === 1 ? 'title' : 'titles'}.`;
      show(metadataRefresh.status.data.errorSummary ? `${result} ${firstErrorLine(metadataRefresh.status.data.errorSummary)}` : result, metadataRefresh.status.data.errorSummary ? 'info' : 'success');
    }
    if (previousMetadataRefreshStatus.current === 'running' && metadataRefresh.status.data?.status === 'failed') show(`Metadata refresh failed — ${firstErrorLine(metadataRefresh.status.data.errorSummary)}`, 'error');
    previousMetadataRefreshStatus.current = metadataRefresh.status.data?.status;
  }, [metadataRefresh.status.data, show]);
  const refreshLibrary = () => void client.invalidateQueries({ queryKey: ['movies'], refetchType: 'active' });
  const scan = data?.status === 'running' ? data as ScanRun : undefined;
  const autoAcceptRun = autoAccept.data?.status === 'running' ? autoAccept.data as ScanRun : undefined;
  const metadataRefreshRun = metadataRefresh.status.data?.status === 'running' ? metadataRefresh.status.data as ScanRun : undefined;
  const titleLabel = scan ? `${scan.titlesAdded} new ${scan.titlesAdded === 1 ? 'title' : 'titles'} found` : '';
  return <><CollapsibleBanner open={Boolean(scan)}><div className="relative border-b border-accent-soft-border bg-accent-soft px-4 py-2 text-center text-sm text-accent-soft-foreground"><div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1"><span className="tabular-nums">Scanning library: {scan?.filesProcessed ?? 0} of {scan?.filesFound ?? 0} files processed</span>{scan && scan.filesProcessed > 0 && <button type="button" onClick={refreshLibrary} aria-label="Refresh library results" className="font-medium underline underline-offset-2 hover:text-foreground">{titleLabel} — refresh</button>}</div>{scan && <ProgressRail current={scan.filesProcessed} total={scan.filesFound} />}</div></CollapsibleBanner><CollapsibleBanner open={Boolean(autoAcceptRun)}><div className="relative border-b border-accent-soft-border bg-accent-soft px-4 py-2 text-center text-sm text-accent-soft-foreground"><div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1"><span className="tabular-nums">Accepting matches — {autoAcceptRun?.filesProcessed ?? 0} of {autoAcceptRun?.filesFound ?? 0}.</span>{autoAcceptRun && autoAcceptRun.filesProcessed > 0 && <button type="button" onClick={refreshLibrary} aria-label="Refresh accepted matches" className="font-medium underline underline-offset-2 hover:text-foreground">{autoAcceptRun.titlesAdded} accepted — refresh</button>}</div>{autoAcceptRun && <ProgressRail current={autoAcceptRun.filesProcessed} total={autoAcceptRun.filesFound} />}</div></CollapsibleBanner><CollapsibleBanner open={Boolean(metadataRefreshRun)}><div className="relative border-b border-warning-border/50 bg-warning-soft px-4 py-2 text-center text-sm text-warning"><div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1"><span className="tabular-nums">Refreshing metadata: {metadataRefreshRun?.filesProcessed ?? 0} of {metadataRefreshRun?.filesFound ?? 0} titles checked.</span>{metadataRefreshRun && metadataRefreshRun.filesProcessed > 0 && <button type="button" onClick={refreshLibrary} className="font-medium underline underline-offset-2 hover:text-foreground">{metadataRefreshRun.titlesAdded} updated — refresh</button>}</div>{metadataRefreshRun && <ProgressRail current={metadataRefreshRun.filesProcessed} total={metadataRefreshRun.filesFound} tone="warning" />}</div></CollapsibleBanner></>;
}
