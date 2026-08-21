import type { MediaInfo, MediaTrack } from '@ottlib/shared';
import { useState } from 'react';
import { useToast } from '../hooks/useToast';

const languageNames: Record<string, string> = {
  en: 'English', eng: 'English', hi: 'Hindi', hin: 'Hindi', ta: 'Tamil', tam: 'Tamil', te: 'Telugu', tel: 'Telugu', ml: 'Malayalam', mal: 'Malayalam',
  bn: 'Bengali', ben: 'Bengali', de: 'German', deu: 'German', es: 'Spanish', spa: 'Spanish', fr: 'French', fra: 'French', it: 'Italian', ita: 'Italian',
  ja: 'Japanese', jpn: 'Japanese', ko: 'Korean', kor: 'Korean', pt: 'Portuguese', por: 'Portuguese', ru: 'Russian', rus: 'Russian', zh: 'Chinese', zho: 'Chinese'
};

function displayLanguage(value: string | null): string { return value ? languageNames[value.toLowerCase()] ?? value.toUpperCase() : 'Unknown'; }
function resolution(info: MediaInfo): string | null {
  if (!info.height) return null;
  if (info.height >= 2160) return '4K';
  if (info.height >= 1440) return '1440p';
  return `${info.height}p`;
}
function trackDetails(track: MediaTrack): string {
  const audioLayout = track.channelLayout ?? (track.channels ? `${track.channels}.0` : null);
  return [track.codec, audioLayout, track.title, track.source === 'external' ? 'External' : null, track.isDefault ? 'Default' : null, track.isForced ? 'Forced' : null, track.isHearingImpaired ? 'SDH' : null].filter(Boolean).join(' · ');
}
function TrackList({ title, tracks }: { title: string; tracks: MediaTrack[] }) {
  if (!tracks.length) return null;
  return <div>
    <h3 className="text-xs font-semibold uppercase tracking-wide text-subtle">{title}</h3>
    <ul className="mt-2 space-y-2">
      {tracks.map((track) => <li key={`${track.source}-${track.order}`} className="text-sm leading-5">
        <p className="font-medium text-foreground">{displayLanguage(track.language)}</p>
        {trackDetails(track) && <p className="text-xs text-muted">{trackDetails(track)}</p>}
      </li>)}
    </ul>
  </div>;
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText && window.isSecureContext) { await navigator.clipboard.writeText(value); return; }
  const input = document.createElement('textarea');
  input.value = value; input.setAttribute('readonly', ''); input.style.position = 'fixed'; input.style.opacity = '0';
  document.body.append(input); input.select();
  const copied = document.execCommand('copy'); input.remove();
  if (!copied) throw new Error('Copy is not available in this browser');
}

export function MediaInfoPanel({ mediaInfo, filePath }: { mediaInfo: MediaInfo | null; filePath: string }) {
  const { show } = useToast(); const [copied, setCopied] = useState(false);
  const videoDetails = mediaInfo ? [resolution(mediaInfo), mediaInfo.videoCodec, mediaInfo.videoProfile, mediaInfo.hdrFormat].filter(Boolean) : [];
  const hasData = Boolean(filePath || mediaInfo?.container || videoDetails.length || mediaInfo?.tracks.length);
  if (!hasData) return null;
  const audio = mediaInfo?.tracks.filter((track) => track.type === 'audio') ?? [];
  const subtitles = mediaInfo?.tracks.filter((track) => track.type === 'subtitle') ?? [];
  const copyPath = async () => {
    try { await copyText(filePath); setCopied(true); show('File path copied.', 'success'); window.setTimeout(() => setCopied(false), 2_000); }
    catch (error) { show(error instanceof Error ? error.message : 'Unable to copy the file path', 'error'); }
  };
  return <aside className="rounded-xl border border-border bg-surface-raised/70 p-4 xl:col-start-3 xl:row-start-1">
    <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-subtle">Media info</h2>
    {videoDetails.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{videoDetails.map((detail) => <span key={detail} className="rounded-full border border-border bg-surface px-2 py-0.5 text-xs font-medium text-foreground">{detail}</span>)}</div>}
    {mediaInfo?.width && mediaInfo.height && <p className="mt-2 text-xs text-muted">{mediaInfo.width.toLocaleString()} × {mediaInfo.height.toLocaleString()}{mediaInfo.container ? ` · ${mediaInfo.container}` : ''}</p>}
    {!mediaInfo?.width && mediaInfo?.container && <p className="mt-2 text-xs text-muted">{mediaInfo.container}</p>}
    <div className="mt-4 space-y-4">
      <TrackList title="Audio" tracks={audio} />
      <TrackList title="Subtitles" tracks={subtitles} />
    </div>
    <div className="mt-4 border-t border-border pt-3">
      <div className="flex items-center justify-between gap-3"><h3 className="text-xs font-semibold uppercase tracking-wide text-subtle">File path</h3><button type="button" onClick={() => void copyPath()} title="Copy file path" aria-label="Copy file path" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-foreground hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"><svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="8" y="8" width="11" height="11" rx="1.5" /><path d="M16 8V6.5A1.5 1.5 0 0 0 14.5 5h-9A1.5 1.5 0 0 0 4 6.5v9A1.5 1.5 0 0 0 5.5 17H8" /></svg><span className="sr-only">{copied ? 'File path copied' : 'Copy file path'}</span></button></div>
      <p className="mt-1.5 break-all font-mono text-xs leading-5 text-muted" title={filePath}>{filePath}</p>
    </div>
  </aside>;
}
