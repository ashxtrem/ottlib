import type { FastifyInstance } from 'fastify';
import { playbackProgressUpdateSchema } from '@ottlib/shared';
import { MovieRepository } from '../repositories/movieRepository.js';
import { PlaybackProgressService } from '../services/playbackProgressService.js';
import { viewerOf } from './viewer.js';

function limit(value: string | undefined): number { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 100) : 20; }

export function registerPlaybackProgressRoutes(app: FastifyInstance, movies: MovieRepository, progress: PlaybackProgressService): void {
  app.get('/api/movies/continue-watching', async (request) => {
    return movies.listContinueWatching(viewerOf(request).profileId, limit((request.query as { limit?: string }).limit));
  });
  app.put('/api/movies/:id/progress', async (request, reply) => {
    const id = Number((request.params as any).id); const viewer = viewerOf(request);
    if (!movies.get(id)) return reply.code(404).send({ error: 'Movie not found' });
    return progress.record(id, viewer, playbackProgressUpdateSchema.parse(request.body));
  });
  app.delete('/api/movies/:id/progress', async (request, reply) => {
    const id = Number((request.params as any).id);
    progress.clear(id, viewerOf(request).profileId); return reply.code(204).send();
  });
}
