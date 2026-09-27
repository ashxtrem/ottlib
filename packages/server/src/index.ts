import { loadBootstrapConfig } from './config/configStore.js';
import { createDatabase } from './db/db.js';
import { buildApp } from './app.js';
import { DiscoveryService } from './services/discoveryService.js';
import { ServerInfoService } from './services/serverInfoService.js';

const config = await loadBootstrapConfig(); const db = createDatabase(config.absoluteAppDataPath); const app = buildApp(db, config.absoluteAppDataPath, config.port);
await app.listen({ host: '0.0.0.0', port: config.port });
if (config.advertise) {
  const info = new ServerInfoService(config.port); const discovery = new DiscoveryService(app.log);
  discovery.start(info.name(), config.port, info.get().addresses);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => {
    setTimeout(() => process.exit(0), 2_000).unref(); // never let a slow mDNS goodbye block shutdown
    void discovery.stop().then(() => app.close()).finally(() => process.exit(0));
  });
}
