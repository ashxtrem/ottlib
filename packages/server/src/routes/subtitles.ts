import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { subtitleDownloadSchema, subtitleSearchSchema } from '@ottlib/shared/subtitles';
import { SubtitleService } from '../services/subtitles/subtitleService.js';

const movieParams = z.object({ id: z.coerce.number().int().positive() });
export function registerSubtitleRoutes(app: FastifyInstance, subtitles: SubtitleService): void {
  app.get('/api/subtitles/options', async () => subtitles.options());
  app.post('/api/movies/:id/subtitles/search', async request => {
    const { id } = movieParams.parse(request.params);
    return subtitles.search(id, subtitleSearchSchema.parse(request.body));
  });
  app.post('/api/movies/:id/subtitles/download', async request => {
    const { id } = movieParams.parse(request.params);
    return subtitles.download(id, subtitleDownloadSchema.parse(request.body).resultId);
  });
}
