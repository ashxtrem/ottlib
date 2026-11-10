import type { Settings, UpgradeCandidate } from '@ottlib/shared';
import { oldVideoCodecs, preferredResolutionMinimumHeight, upgradeCandidateLimit } from '../../config/defaults.js';
import type { MovieUpgradeRepository } from '../../repositories/movieUpgradeRepository.js';

/** Library titles worth replacing: below the preferred resolution, or in an old codec. */
export class UpgradeCandidateService {
  public constructor(private readonly upgrades: MovieUpgradeRepository, private readonly settings: () => Pick<Settings, 'torrentPreferredResolution'>) {}

  public candidates(profileId: number): UpgradeCandidate[] {
    const preferred = this.settings().torrentPreferredResolution;
    return this.upgrades.listCandidates(profileId, {
      minimumHeight: preferred ? preferredResolutionMinimumHeight[preferred] : null,
      oldCodecs: oldVideoCodecs,
      limit: upgradeCandidateLimit
    });
  }
}
