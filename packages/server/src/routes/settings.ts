import type { FastifyInstance } from 'fastify';
import { updateSettingsSchema } from '@ottlib/shared';
import { SettingsService } from '../services/settingsService.js';

export function registerSettingsRoutes(app: FastifyInstance, settings: SettingsService): void {
  app.get('/api/settings', async () => settings.get());
  app.put('/api/settings', async (request) => settings.update(updateSettingsSchema.parse(request.body)));
}
