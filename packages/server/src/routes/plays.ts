import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { playStartSchema } from '@ottlib/shared';
import type { MovieRepository } from '../repositories/movieRepository.js';
import type { PlaybackHistoryService } from '../services/playbackHistoryService.js';
import { viewerOf } from './viewer.js';

const paramsSchema = z.object({ id: z.coerce.number().int().positive() });

/** Clients announce a play before handing a title to a player; progress saves later finish it. */
export function registerPlayRoutes(app: FastifyInstance, movies: MovieRepository, history: PlaybackHistoryService): void {
  app.post('/api/movies/:id/plays', async (request, reply) => {
    const viewer = viewerOf(request);
    const { id } = paramsSchema.parse(request.params);
    const body = playStartSchema.parse(request.body ?? {});
    if (!movies.get(id)) return reply.code(404).send({ error: 'Movie not found' });
    return { playId: history.start(viewer, id, body.method, body.positionMs) };
  });
}
