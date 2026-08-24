import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../hooks/apiClient';
import { useToast } from '../hooks/useToast';

export function TorrentSendButton({ url }: { url: string }) {
  const { show } = useToast();
  const [copyFallback, setCopyFallback] = useState(false);
  const send = useMutation({
    mutationFn: () => api<{ sent: true }>('/api/torrents/send', { method: 'POST', body: JSON.stringify({ url }) }),
    onSuccess: () => show('Sent to qBittorrent.', 'success'),
    onError: (error) => show(error.message, 'error')
  });
  const copy = async () => {
    const copied = await copyText(url);
    if (copied) { setCopyFallback(false); show(url.startsWith('magnet:') ? 'Magnet copied.' : 'Torrent link copied.', 'success'); }
    else setCopyFallback(true);
  };
  return <div className="flex flex-wrap items-center gap-2">
    <button type="button" onClick={() => send.mutate()} disabled={send.isPending} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60">{send.isPending ? 'Sending…' : 'Send to qBittorrent'}</button>
    <button type="button" onClick={() => void copy()} className="rounded-lg border border-border-strong px-3 py-1.5 text-sm hover:bg-surface-raised">{url.startsWith('magnet:') ? 'Copy magnet' : 'Copy link'}</button>
    {copyFallback && <input readOnly value={url} aria-label="Torrent link to copy" onFocus={(event) => event.currentTarget.select()} className="w-full rounded border border-border bg-field px-2 py-1 text-xs" />}
  </div>;
}

async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(value); return true; }
  } catch { /* Plain HTTP on a LAN is not a secure clipboard context. */ }
  const input = document.createElement('input'); input.value = value; input.setAttribute('readonly', ''); input.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
  document.body.appendChild(input); input.select(); input.setSelectionRange(0, value.length);
  const copied = document.execCommand('copy'); input.remove(); return copied;
}
