import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PlaybackSource } from '@ottlib/shared';
import { subtitleSearchSchema, type SubtitleDownloadResponse, type SubtitleOptions, type SubtitleSearch, type SubtitleSearchResponse } from '@ottlib/shared/subtitles';
import { api } from './apiClient';

export function useSubtitles(movieId: number) {
  const client = useQueryClient();
  const options = useQuery({ queryKey: ['subtitle-options'], queryFn: () => api<SubtitleOptions>('/api/subtitles/options') });
  const available = useQuery({ queryKey: ['subtitle-files', movieId], queryFn: () => api<PlaybackSource>(`/api/movies/${movieId}/playback`) });
  const [languages, setLanguages] = useState('');
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set());
  const initialized = useRef(false);
  useEffect(() => {
    if (!options.data || initialized.current) return;
    initialized.current = true;
    let saved: string | null = null;
    try { saved = localStorage.getItem('subtitle-search-languages'); } catch { /* Storage may be disabled. */ }
    setLanguages(saved || options.data.preferredLanguages.join(', '));
  }, [options.data]);
  const search = useMutation({
    mutationFn: (input: SubtitleSearch) => {
      const validated = subtitleSearchSchema.parse(input);
      try { localStorage.setItem('subtitle-search-languages', validated.languages.join(', ')); } catch { /* Optional preference. */ }
      return api<SubtitleSearchResponse>(`/api/movies/${movieId}/subtitles/search`, { method: 'POST', body: JSON.stringify(validated) });
    },
  });
  const download = useMutation({
    mutationFn: (resultId: string) => api<SubtitleDownloadResponse>(`/api/movies/${movieId}/subtitles/download`, { method: 'POST', body: JSON.stringify({ resultId }) }),
    onSuccess: (_result, resultId) => { setSavedIds(previous => new Set(previous).add(resultId)); void available.refetch(); void client.invalidateQueries({ queryKey: ['movie', String(movieId)] }); },
  });
  return { options, available, languages, setLanguages, search, download, savedIds };
}
