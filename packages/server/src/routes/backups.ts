import type { FastifyInstance } from 'fastify';
import { BackupService } from '../services/backupService.js';
import { isLoopback } from './loopback.js';

export function registerBackupRoutes(app: FastifyInstance, backups: BackupService): void {
  app.get('/api/backups', async () => backups.list());
  app.post('/api/backups', async () => backups.create('manual'));
  app.delete<{ Params: { name: string } }>('/api/backups/:name', async (request, reply) => {
    backups.remove(request.params.name);
    return reply.code(204).send();
  });
  app.post<{ Params: { name: string } }>('/api/backups/:name/restore', async (request, reply) => {
    if (!isLoopback(request.socket.remoteAddress)) return reply.code(403).send({ error: 'Restoring a backup is only allowed from the server machine' });
    backups.requestRestore(request.params.name);
    return { status: 'pending-restart' };
  });
}
