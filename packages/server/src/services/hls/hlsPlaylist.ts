import type { SegmentPlan } from './segmentPlan.js';

/**
 * VOD media playlist for a segment plan. URIs are relative (init.mp4, seg-<n>.m4s) and each carries `query`,
 * the stream key query string (e.g. '?key=...' from AccessPinService.streamQuery, or '').
 */
export function buildHlsPlaylist(plan: SegmentPlan, query: string): string {
  const lines = [
    '#EXTM3U',
    '#EXT-X-VERSION:7',
    '#EXT-X-PLAYLIST-TYPE:VOD',
    `#EXT-X-TARGETDURATION:${plan.targetDuration}`,
    '#EXT-X-MEDIA-SEQUENCE:0',
    '#EXT-X-INDEPENDENT-SEGMENTS',
    `#EXT-X-MAP:URI="init.mp4${query}"`,
  ];
  plan.segments.forEach((segment, index) => {
    lines.push(`#EXTINF:${(segment.duration / 1000).toFixed(3)},`, `seg-${index}.m4s${query}`);
  });
  lines.push('#EXT-X-ENDLIST');
  return `${lines.join('\n')}\n`;
}
