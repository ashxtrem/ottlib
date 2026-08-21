import { useScanStatus } from '../hooks/useScanStatus';

export function ScanStatusBanner() {
  const { data } = useScanStatus(); if (data?.status !== 'running') return null;
  return <div className="border-b border-accent-soft-border bg-accent-soft px-4 py-2 text-center text-sm text-accent-soft-foreground">Scanning library: {data.filesProcessed} of {data.filesFound} files processed</div>;
}
