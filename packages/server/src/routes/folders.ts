import type { FastifyInstance } from 'fastify';
import { createFolderSchema } from '@ottlib/shared';
import { FolderService } from '../services/folderService.js';
import { pickFolder } from '../services/folderPickerService.js';

export function registerFolderRoutes(app: FastifyInstance, folders: FolderService): void {
  app.get('/api/folders', async () => folders.list());
  app.post('/api/folders', async (request, reply) => { const folder = await folders.add(createFolderSchema.parse(request.body).path); return reply.code(201).send(folder); });
  app.post('/api/folders/select', async () => ({ path: await pickFolder() }));
  app.delete('/api/folders/:id', async (request, reply) => { folders.remove(Number((request.params as any).id)); return reply.code(204).send(); });
}
