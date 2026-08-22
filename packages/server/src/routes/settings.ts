import type { FastifyInstance } from 'fastify';
import { scheduleValidationRequestSchema, testTmdbKeySchema, updateSettingsSchema } from '@ottlib/shared';
import { SettingsService } from '../services/settingsService.js';

export function registerSettingsRoutes(app: FastifyInstance, settings: SettingsService): void {
  app.get('/api/settings', async () => settings.get());
  app.put('/api/settings', async (request) => settings.update(updateSettingsSchema.parse(request.body)));
  app.post('/api/settings/schedule/validate', async (request) => settings.validateSchedule(scheduleValidationRequestSchema.parse(request.body ?? {}).scheduleCron));
  app.post('/api/settings/tmdb/test', async (request) => settings.testTmdbKey(testTmdbKeySchema.parse(request.body ?? {}).tmdbApiKey));
}
