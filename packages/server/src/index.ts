import { loadBootstrapConfig } from './config/configStore.js';
import { createDatabase } from './db/db.js';
import { buildApp } from './app.js';

const config = await loadBootstrapConfig(); const db = createDatabase(config.absoluteAppDataPath); const app = buildApp(db, config.absoluteAppDataPath, config.port);
await app.listen({ host: '0.0.0.0', port: config.port });
