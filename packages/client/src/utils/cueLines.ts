/** The part of a `TextTrackCue` the overlay needs (a `VTTCue` has `text`; other cue kinds don't, so it is optional). */
export interface CueLike {
  text?: string;
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&nbsp;': ' ', '&lrm;': '', '&rlm;': '', '&quot;': '"', '&#39;': "'" };

/**
 * Turns the active cues into plain lines of text for the caption overlay. WebVTT markup (`<i>`, `<b>`, `<v Name>`, `<c.x>`,
 * timestamps) is dropped and the few WebVTT entities are decoded; the result is rendered as React text, so nothing is
 * ever injected as HTML. Blank lines are skipped; each cue's own line breaks are kept.
 */
export function cuesToLines(cues: readonly CueLike[]): string[] {
  const lines: string[] = [];
  for (const cue of cues) {
    const plain = (cue.text ?? '').replace(/<[^>]*>/g, '').replace(/&(?:amp|lt|gt|nbsp|lrm|rlm|quot|#39);/g, (entity) => ENTITIES[entity] ?? entity);
    for (const line of plain.split(/\r\n|\r|\n/)) {
      const trimmed = line.trim();
      if (trimmed) lines.push(trimmed);
    }
  }
  return lines;
}
