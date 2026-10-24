import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { NextPlaybackService } from '../services/nextPlaybackService.js';
import { PlaybackProgressService } from '../services/playbackProgressService.js';
import { LibraryService } from '../services/libraryService.js';
import { viewerOf } from './viewer.js';

const querySchema = z.object({ shelfId: z.coerce.number().int().positive().optional() });
const paramsSchema = z.object({ id: z.coerce.number().int().positive() });

export function registerNextPlaybackRoutes(app: FastifyInstance, next: NextPlaybackService, progress: PlaybackProgressService, library: LibraryService): void {
  app.get('/api/movies/:id/next', async (request, reply) => {
    const { profileId } = viewerOf(request);
    const { id } = paramsSchema.parse(request.params);
    const { shelfId } = querySchema.parse(request.query);
    if (!library.get(id)) return reply.code(404).send({ error: 'Movie not found' });
    const movie = next.next(id, profileId, shelfId);
    return movie ? library.get(movie.id, profileId) : null;
  });
  app.post('/api/movies/:id/complete', async (request, reply) => {
    const viewer = viewerOf(request);
    const { id } = paramsSchema.parse(request.params);
    const { shelfId } = querySchema.parse(request.query);
    if (!library.get(id)) return reply.code(404).send({ error: 'Movie not found' });
    progress.complete(id, viewer, shelfId);
    return library.get(id, viewer.profileId);
  });
}
