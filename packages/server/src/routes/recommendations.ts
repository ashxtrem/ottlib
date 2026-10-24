import type { FastifyInstance } from 'fastify';
import type { MovieRepository } from '../repositories/movieRepository.js';
import type { RecommendationService } from '../services/recommendations/recommendationService.js';
import { requireProfile } from './profileContext.js';

function limit(value: string | undefined): number {
  const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 48) : 24;
}

export function registerRecommendationRoutes(app: FastifyInstance, movies: MovieRepository, recommendations: RecommendationService): void {
  app.get('/api/movies/:id/recommendations', async (request, reply) => {
    const id = Number((request.params as { id: string }).id); if (!movies.get(id)) return reply.code(404).send({ error: 'Movie not found' });
    return recommendations.forMovie(id, requireProfile(request), limit((request.query as { limit?: string }).limit));
  });
}
