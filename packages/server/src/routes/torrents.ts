import type { FastifyInstance } from 'fastify';
import { sendTorrentRequestSchema, torrentSearchStartSchema } from '@ottlib/shared';
import { TorrentConnectionService } from '../services/torrentConnectionService.js';
import { TorrentHandoffService } from '../services/torrentHandoffService.js';
import { TorrentSearchService } from '../services/torrentSearchService.js';
import { TorrentDownloadService } from '../services/torrentDownloadService.js';

/** Torrent search is opt-in: while it is switched off in Settings every torrent route answers 404. */
export function registerTorrentRoutes(app: FastifyInstance, searches: TorrentSearchService, handoff: TorrentHandoffService, connection: TorrentConnectionService, downloads: TorrentDownloadService, enabled: () => boolean): void {
  void app.register(async (scope) => {
    scope.addHook('onRequest', async (_request, reply) => { if (!enabled()) return reply.code(404).send({ error: 'Torrent search is turned off. Turn it on in Settings.' }); });
    scope.post('/api/torrents/search', async (request) => searches.start(...toSearchArgs(torrentSearchStartSchema.parse(request.body))));
    scope.get('/api/torrents/search/:searchId', async (request) => searches.status(searchId(request.params)));
    scope.delete('/api/torrents/search/:searchId', async (request, reply) => { await searches.cancel(searchId(request.params)); return reply.code(204).send(); });
    scope.post('/api/torrents/send', async (request) => { const input = sendTorrentRequestSchema.parse(request.body); await handoff.send(input.url); return { sent: true }; });
    scope.get('/api/torrents/connection', async () => connection.status());
    scope.post('/api/torrents/connection/test', async () => connection.test());
    scope.get('/api/torrents/active', async () => downloads.active());
  });
}

function toSearchArgs(input: { q: string; year?: number }): [string, number | undefined] { return [input.q, input.year]; }
function searchId(value: unknown): string {
  const id = (value as { searchId?: unknown } | undefined)?.searchId;
  if (typeof id !== 'string' || !id.trim()) throw new Error('Invalid torrent search id.');
  return id;
}
