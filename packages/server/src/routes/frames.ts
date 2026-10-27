import type { FastifyInstance } from 'fastify';
import { framePreviewConfig } from '../config/framePreview.js';
import { FrameError, type FrameService } from '../services/frames/frameService.js';
import { MovieUnavailableError } from '../services/playbackService.js';

export const frameRoute = '/api/movies/:id/frame';

/**
 * A seek-bar preview frame (JPEG) at `t` milliseconds. Reachable with the movie's `?key=` so `<img>` and Coil need no headers.
 * The playback source's `framePreviewUrl` ends in `?key=<k>` or a bare `?`, so `t` may come after an empty parameter (`?&t=...`).
 */
export function registerFrameRoutes(app: FastifyInstance, frames: FrameService): void {
  app.get(frameRoute, async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    const t = (request.query as { t?: unknown }).t;
    if (typeof t !== 'string' || !/^-?\d+(\.\d+)?$/.test(t)) return reply.code(400).send({ error: 't must be a time in milliseconds' });
    if (!Number.isInteger(id)) return reply.code(404).send({ error: 'Movie file is unavailable' });
    const controller = new AbortController();
    // `close` also fires after a finished response; only an unfinished one means the client went away.
    reply.raw.once('close', () => { if (!reply.raw.writableFinished) controller.abort(); });
    try {
      const jpeg = await frames.frame(id, Number(t), request.ip, controller.signal);
      if (!jpeg) return reply.code(204).send();
      return reply.header('content-type', 'image/jpeg').header('cache-control', framePreviewConfig.cacheControl).send(jpeg);
    } catch (error) {
      if (error instanceof MovieUnavailableError) return reply.code(404).send({ error: error.message });
      if (error instanceof FrameError) return reply.code(error.status).send({ error: error.message });
      throw error;
    }
  });
}
