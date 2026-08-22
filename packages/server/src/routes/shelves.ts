import type { FastifyInstance, FastifyReply } from 'fastify';
import { deviceIdSchema, movieShelfMembershipUpdateSchema, shelfCreateSchema, shelfMovieIdsSchema, shelfOrderSchema, shelfRenameSchema } from '@ottlib/shared';
import { ShelfService, type ShelfResult } from '../services/shelfService.js';

function deviceId(headers: Record<string, unknown>): string | undefined {
  const parsed = deviceIdSchema.safeParse(headers['x-device-id']);
  return parsed.success ? parsed.data : undefined;
}

function id(value: unknown): number { return Number(value); }

function sendResult<T>(reply: FastifyReply, result: ShelfResult<T>): T | undefined {
  if ('value' in result) return result.value;
  const errors = {
    'shelf-not-found': [404, 'Shelf not found'],
    'movie-not-found': [404, 'Movie not found'],
    'name-conflict': [409, 'A shelf with that name already exists'],
    'invalid-order': [400, 'Order must contain every title in this shelf exactly once']
  } as const;
  const [status, message] = errors[result.error];
  reply.code(status).send({ error: message });
  return undefined;
}

export function registerShelfRoutes(app: FastifyInstance, shelves: ShelfService): void {
  app.get('/api/shelves', async () => shelves.list());
  app.post('/api/shelves', async (request, reply) => {
    const body = shelfCreateSchema.parse(request.body);
    return sendResult(reply, shelves.create(body.name, body.movieIds, deviceId(request.headers)));
  });
  app.get('/api/shelves/:id', async (request, reply) => {
    const shelf = shelves.get(id((request.params as { id: string }).id), deviceId(request.headers));
    return shelf ?? reply.code(404).send({ error: 'Shelf not found' });
  });
  app.patch('/api/shelves/:id', async (request, reply) => {
    const body = shelfRenameSchema.parse(request.body);
    return sendResult(reply, shelves.rename(id((request.params as { id: string }).id), body.name));
  });
  app.delete('/api/shelves/:id', async (request, reply) => sendResult(reply, shelves.remove(id((request.params as { id: string }).id))));
  app.post('/api/shelves/:id/movies', async (request, reply) => {
    const body = shelfMovieIdsSchema.parse(request.body);
    return sendResult(reply, shelves.addMovies(id((request.params as { id: string }).id), body.movieIds, deviceId(request.headers)));
  });
  app.delete('/api/shelves/:id/movies/:movieId', async (request, reply) => {
    return sendResult(reply, shelves.removeMovie(id((request.params as { id: string }).id), id((request.params as { movieId: string }).movieId), deviceId(request.headers)));
  });
  app.put('/api/shelves/:id/order', async (request, reply) => {
    const body = shelfOrderSchema.parse(request.body);
    return sendResult(reply, shelves.reorder(id((request.params as { id: string }).id), body.movieIds, deviceId(request.headers)));
  });
  app.put('/api/movies/:id/shelves', async (request, reply) => {
    const body = movieShelfMembershipUpdateSchema.parse(request.body);
    return sendResult(reply, shelves.updateMovieShelves(id((request.params as { id: string }).id), body.shelfIds, body.newShelfName, deviceId(request.headers)));
  });
}
