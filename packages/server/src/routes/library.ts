import type { FastifyInstance } from 'fastify';
import { acceptCandidateSchema, deviceIdSchema, imdbLookupSchema, moviePatchSchema, rematchSchema, watchStateSchema } from '@ottlib/shared';
import { MetadataMatchService } from '../services/metadataMatchService.js';
import { MovieRepository } from '../repositories/movieRepository.js';
import { WatchStateRepository } from '../repositories/watchStateRepository.js';
import { LibraryService } from '../services/libraryService.js';

function deviceId(headers: Record<string, unknown>): string | undefined { const parsed = deviceIdSchema.safeParse(headers['x-device-id']); return parsed.success ? parsed.data : undefined; }
function minRating(value: string | undefined): number | undefined {
  if (value === undefined || value === '') return undefined;
  const rating = Number(value); return Number.isFinite(rating) && rating >= 0 && rating <= 10 ? rating : undefined;
}
function limit(value: string | undefined): number {
  const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 100) : 48;
}

export function registerLibraryRoutes(app: FastifyInstance, movies: MovieRepository, watches: WatchStateRepository, matcher: MetadataMatchService, library: LibraryService): void {
  app.get('/api/movies', async (request) => {
    const query = request.query as { search?: string; watched?: string; availability?: string; sort?: string; genre?: string; actor?: string; quality?: string; audioLanguage?: string; minRating?: string; needsReview?: string; cursor?: string; limit?: string };
    const availability = query.availability === 'available' || query.availability === 'unavailable' ? query.availability : undefined;
    return library.listSummaries(deviceId(request.headers), { search: query.search, watched: query.watched === undefined ? undefined : query.watched === 'true', availability, sort: query.sort, genre: query.genre, actor: query.actor, quality: query.quality, audioLanguage: query.audioLanguage, minRating: minRating(query.minRating), needsReview: query.needsReview === 'true', cursor: query.cursor, limit: limit(query.limit) });
  });
  app.get('/api/movies/filter-options', async () => movies.listFilterOptions());
  app.get('/api/movies/:id', async (request, reply) => {
    const movie = library.get(Number((request.params as any).id), deviceId(request.headers)); if (!movie) return reply.code(404).send({ error: 'Movie not found' }); return movie;
  });
  app.patch('/api/movies/:id', async (request, reply) => {
    const id = Number((request.params as any).id); if (!movies.get(id)) return reply.code(404).send({ error: 'Movie not found' });
    movies.updateTitleOverride(id, moviePatchSchema.parse(request.body).titleOverride); return library.get(id, deviceId(request.headers));
  });
  app.put('/api/movies/:id/watch-state', async (request, reply) => {
    const id = Number((request.params as any).id); const idHeader = deviceId(request.headers); if (!idHeader) return reply.code(400).send({ error: 'X-Device-Id must be a UUID' });
    if (!movies.get(id)) return reply.code(404).send({ error: 'Movie not found' }); watches.set(id, idHeader, watchStateSchema.parse(request.body).watched); return library.get(id, idHeader);
  });
  app.post('/api/movies/:id/rematch', async (request, reply) => {
    const id = Number((request.params as any).id); if (!movies.get(id)) return reply.code(404).send({ error: 'Movie not found' });
    const { title } = rematchSchema.parse(request.body ?? {});
    movies.resetForRematch(id); await matcher.suggest(id, title); return library.get(id, deviceId(request.headers));
  });
  app.get('/api/movies/:id/candidates', async (request, reply) => {
    const id = Number((request.params as any).id); if (!movies.get(id)) return reply.code(404).send({ error: 'Movie not found' });
    return movies.getCandidates(id);
  });
  app.post('/api/movies/:id/candidates/:candidateId/accept', async (request, reply) => {
    const id = Number((request.params as any).id); const candidateId = Number((request.params as any).candidateId);
    if (!movies.get(id)) return reply.code(404).send({ error: 'Movie not found' });
    const result = await matcher.accept(id, candidateId, acceptCandidateSchema.parse(request.body ?? {}));
    if (result === 'not-found') return reply.code(404).send({ error: 'Candidate not found' });
    if (result === 'needs-episode') return reply.code(400).send({ error: 'This is a TV show — provide a season and episode number' });
    return library.get(id, deviceId(request.headers));
  });
  app.post('/api/movies/:id/candidates/reject', async (request, reply) => {
    const id = Number((request.params as any).id); if (!movies.get(id)) return reply.code(404).send({ error: 'Movie not found' });
    matcher.reject(id); return library.get(id, deviceId(request.headers));
  });
  app.post('/api/movies/:id/candidates/from-imdb', async (request, reply) => {
    const id = Number((request.params as any).id); if (!movies.get(id)) return reply.code(404).send({ error: 'Movie not found' });
    const result = await matcher.suggestFromImdb(id, imdbLookupSchema.parse(request.body).imdbId);
    if (result === 'invalid-id') return reply.code(400).send({ error: 'Enter a valid IMDb URL or ID (e.g. tt1375666)' });
    if (result === 'not-found') return reply.code(404).send({ error: 'No provider could find that IMDb title' });
    return library.get(id, deviceId(request.headers));
  });
}
