import type { SubtitleResult } from '@ottlib/shared/subtitles';

export interface SubtitleQuery {
  mode: 'auto' | 'filename' | 'manual'; title: string; filename: string;
  imdbId: string | null; year: number | null; season: number | null; episode: number | null;
  type: 'movie' | 'tv'; languages: string[]; hash?: string;
}
export interface ProviderSubtitle extends Omit<SubtitleResult, 'id' | 'downloaded'> {
  remoteId: string; downloadUrl?: string;
}
export interface SubtitleProvider {
  name: string;
  configured(): boolean;
  search(query: SubtitleQuery): Promise<ProviderSubtitle[]>;
  download(result: ProviderSubtitle): Promise<{ bytes: Buffer; filename: string }>;
}
