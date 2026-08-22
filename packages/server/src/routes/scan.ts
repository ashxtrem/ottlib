import type { FastifyInstance } from 'fastify';
import { ScanRunRepository } from '../repositories/scanRunRepository.js';
import { ScanService } from '../services/scanService.js';

export function registerScanRoutes(app: FastifyInstance, scanner: ScanService, runs: ScanRunRepository): void {
  app.post('/api/scan', async () => scanner.start());
  app.get('/api/scan/status', async () => runs.active() ?? runs.latest() ?? { status: 'idle' });
  app.get('/api/scan/history', async () => runs.list());
}
