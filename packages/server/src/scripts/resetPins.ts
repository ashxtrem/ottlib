import { fileURLToPath } from 'node:url';
import { loadBootstrapConfig } from '../config/configStore.js';
import { createDatabase } from '../db/db.js';
import { AccessPinRepository } from '../repositories/accessPinRepository.js';
import { AuthSessionRepository } from '../repositories/authSessionRepository.js';
import { ProfileRepository } from '../repositories/profileRepository.js';
import { AccessPinService } from '../services/accessPinService.js';
import { LocalResetService } from '../services/localResetService.js';

/**
 * `npm run reset-pins --workspace @ottlib/server`: clears the owner profile's PIN and the access PIN, the same as
 * `POST /api/profiles/reset-local`. npm runs workspace scripts inside packages/server, but the server itself runs from
 * the repository root, so the config (and with it the database) is resolved from there.
 */
const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const config = await loadBootstrapConfig(repoRoot);
const db = createDatabase(config.absoluteAppDataPath);
try {
  const result = new LocalResetService(new ProfileRepository(db), new AccessPinService(new AccessPinRepository(db), new AuthSessionRepository(db))).reset();
  console.log(`Library: ${config.absoluteAppDataPath}`);
  console.log(result.ownerPinCleared ? 'Owner profile PIN cleared.' : 'Owner profile had no PIN.');
  console.log(result.accessPinCleared ? 'Access PIN cleared; every device is signed out.' : 'No access PIN was set.');
} finally {
  db.close();
}
