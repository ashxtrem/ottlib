import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useScanStatus } from '../hooks/useScanStatus';
import { useToast } from '../hooks/useToast';

function firstErrorLine(errorSummary: string | null): string {
  return errorSummary?.split(/\r?\n/, 1)[0]?.trim() || 'Check Recent scans for details.';
}

export function ScanStatusBanner() {
  const { data } = useScanStatus(); const client = useQueryClient();
  const { show } = useToast(); const previousStatus = useRef<'idle' | 'running' | 'completed' | 'failed' | undefined>(undefined);
  useEffect(() => {
    if (previousStatus.current === 'running' && data?.status === 'failed') show(`Scan failed — ${firstErrorLine(data.errorSummary)}`, 'error');
    if (previousStatus.current === 'running' && data?.status === 'completed') show(`Scan finished — ${data.titlesAdded} new ${data.titlesAdded === 1 ? 'title' : 'titles'}.`, 'success');
    previousStatus.current = data?.status;
  }, [data, show]);
  if (data?.status !== 'running') return null;
  const refreshLibrary = () => void client.invalidateQueries({ queryKey: ['movies'], refetchType: 'active' });
  const titleLabel = `${data.titlesAdded} new ${data.titlesAdded === 1 ? 'title' : 'titles'} found`;
  return <div className="border-b border-accent-soft-border bg-accent-soft px-4 py-2 text-center text-sm text-accent-soft-foreground"><div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1"><span>Scanning library: {data.filesProcessed} of {data.filesFound} files processed</span>{data.filesProcessed > 0 && <button type="button" onClick={refreshLibrary} aria-label="Refresh library results" className="font-medium underline underline-offset-2 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">{titleLabel} — refresh</button>}</div></div>;
}
