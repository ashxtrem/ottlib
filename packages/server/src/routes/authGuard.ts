import type { FastifyInstance } from 'fastify';
import { AccessPinService } from '../services/accessPinService.js';
import { sessionToken } from './sessionCookie.js';

/** Routes that answer without signing in: discovery/compatibility probing and the sign-in itself. */
const publicRoutes = new Set(['/api/server-info', '/api/auth/status', '/api/auth/login']);
/** Routes an external player may open with the per-movie `?key=` from the playback source instead of a session. */
const streamKeyRoutes = new Set(['/api/stream/:id', '/api/stream/:id/playlist.m3u', '/api/movies/:id/subtitles/:order']);

/**
 * When an access PIN is set, every API and media route needs a session. Matching is on the route pattern Fastify
 * resolved, not the raw URL, so encoded or oddly-spelled paths cannot slip past. The web app's own files stay
 * public so its sign-in screen can load.
 */
export function registerAuthGuard(app: FastifyInstance, pins: AccessPinService): void {
  app.addHook('onRequest', async (request, reply) => {
    const route = request.routeOptions.url;
    if (route === undefined || route === '/*' || publicRoutes.has(route)) return;
    if (pins.isAuthenticated(sessionToken(request))) return;
    if (streamKeyRoutes.has(route)) {
      const id = Number((request.params as { id?: string }).id); const key = (request.query as { key?: unknown }).key;
      if (pins.verifyStreamKey(id, typeof key === 'string' ? key : undefined)) return;
    }
    return reply.code(401).send({ error: 'Enter the access PIN to continue.' });
  });
}
