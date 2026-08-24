import type { FastifyInstance } from 'fastify';
import { sendTorrentRequestSchema, torrentSearchStartSchema } from '@ottlib/shared';
import { TorrentConnectionService } from '../services/torrentConnectionService.js';
import { TorrentHandoffService } from '../services/torrentHandoffService.js';
import { TorrentSearchService } from '../services/torrentSearchService.js';
import { TorrentDownloadService } from '../services/torrentDownloadService.js';

export function registerTorrentRoutes(app: FastifyInstance, searches: TorrentSearchService, handoff: TorrentHandoffService, connection: TorrentConnectionService, downloads: TorrentDownloadService): void {
  app.post('/api/torrents/search', async (request) => searches.start(...toSearchArgs(torrentSearchStartSchema.parse(request.body))));
  app.get('/api/torrents/search/:searchId', async (request) => searches.status(searchId(request.params)));
  app.delete('/api/torrents/search/:searchId', async (request, reply) => { await searches.cancel(searchId(request.params)); return reply.code(204).send(); });
  app.post('/api/torrents/send', async (request) => { const input = sendTorrentRequestSchema.parse(request.body); await handoff.send(input.url); return { sent: true }; });
  app.get('/api/torrents/connection', async () => connection.status());
  app.post('/api/torrents/connection/test', async () => connection.test());
  app.get('/api/torrents/active', async () => downloads.active());
}

function toSearchArgs(input: { q: string; year?: number }): [string, number | undefined] { return [input.q, input.year]; }
function searchId(value: unknown): string {
  const id = (value as { searchId?: unknown } | undefined)?.searchId;
  if (typeof id !== 'string' || !id.trim()) throw new Error('Invalid torrent search id.');
  return id;
}
