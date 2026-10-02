import type { FastifyInstance } from 'fastify';
import { deviceIdSchema } from '@ottlib/shared';
import { z } from 'zod';
import { NextPlaybackService } from '../services/nextPlaybackService.js';
import { PlaybackProgressService } from '../services/playbackProgressService.js';
import { LibraryService } from '../services/libraryService.js';

const querySchema = z.object({ shelfId: z.coerce.number().int().positive().optional() });
const paramsSchema = z.object({ id: z.coerce.number().int().positive() });

export function registerNextPlaybackRoutes(app: FastifyInstance, next: NextPlaybackService, progress: PlaybackProgressService, library: LibraryService): void {
  app.get('/api/movies/:id/next', async (request, reply) => {
    const device = deviceIdSchema.safeParse(request.headers['x-device-id']);
    if (!device.success) return reply.code(400).send({ error: 'X-Device-Id must be a UUID' });
    const { id } = paramsSchema.parse(request.params);
    const { shelfId } = querySchema.parse(request.query);
    if (!library.get(id)) return reply.code(404).send({ error: 'Movie not found' });
    const movie = next.next(id, device.data, shelfId);
    return movie ? library.get(movie.id, device.data) : null;
  });
  app.post('/api/movies/:id/complete', async (request, reply) => {
    const device = deviceIdSchema.safeParse(request.headers['x-device-id']);
    if (!device.success) return reply.code(400).send({ error: 'X-Device-Id must be a UUID' });
    const { id } = paramsSchema.parse(request.params);
    const { shelfId } = querySchema.parse(request.query);
    if (!library.get(id)) return reply.code(404).send({ error: 'Movie not found' });
    progress.complete(id, device.data, shelfId);
    return library.get(id, device.data);
  });
}
