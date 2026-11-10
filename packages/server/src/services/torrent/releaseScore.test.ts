import { describe, expect, it } from 'vitest';
import { releaseQuality } from './releaseQuality.js';
import { noReleasePreferences, releaseScore, type ReleasePreferences } from './releaseScore.js';

const release = (name: string, nbSeeders: number | null = 50, fileSize: number | null = 4 * 1024 ** 3) => ({ quality: releaseQuality(name), nbSeeders, fileSize });
const prefer = (overrides: Partial<ReleasePreferences>): ReleasePreferences => ({ ...noReleasePreferences, ...overrides });

describe('releaseScore', () => {
  it('is null with no preference set', () => {
    expect(releaseScore(release('Movie.2020.1080p.BluRay.x264-GRP'), noReleasePreferences)).toBeNull();
  });

  it('ranks the preferred resolution above a lower one with equal seeders', () => {
    const preferences = prefer({ resolution: '1080p' });
    const exact = releaseScore(release('Movie.2020.1080p.WEB-DL.x264-GRP'), preferences)!;
    const below = releaseScore(release('Movie.2020.720p.WEB-DL.x264-GRP'), preferences)!;
    const above = releaseScore(release('Movie.2020.2160p.WEB-DL.x264-GRP'), preferences)!;
    const far = releaseScore(release('Movie.2020.480p.WEB-DL.x264-GRP'), preferences)!;
    expect(exact).toBeGreaterThan(below);
    expect(below).toBeGreaterThan(above);
    expect(above).toBeGreaterThan(far);
    expect(exact - below).toBe(25);
    expect(below - far).toBe(25);
  });

  it('adds codec, source and a log-scaled seeder bonus', () => {
    const preferences = prefer({ resolution: '1080p', codec: 'hevc' });
    expect(releaseScore(release('Movie.2020.1080p.BluRay.x265-GRP', 1000), preferences)).toBe(100);
    expect(releaseScore(release('Movie.2020.1080p.BluRay.x264-GRP', 1000), preferences)).toBe(80);
    expect(releaseScore(release('Movie.2020.1080p.HDTV.x265-GRP', 0), preferences)).toBe(70);
    expect(releaseScore(release('Movie.2020.1080p.BluRay.x265-GRP', 10), preferences)!).toBeLessThan(releaseScore(release('Movie.2020.1080p.BluRay.x265-GRP', 100), preferences)!);
  });

  it('scores 0 over the size cap and ignores an unknown size', () => {
    const preferences = prefer({ resolution: '1080p', maxSizeGb: 5 });
    expect(releaseScore(release('Movie.2020.1080p.BluRay.x265-GRP', 500, 6 * 1024 ** 3), preferences)).toBe(0);
    expect(releaseScore(release('Movie.2020.1080p.BluRay.x265-GRP', 500, 5 * 1024 ** 3), preferences)!).toBeGreaterThan(0);
    expect(releaseScore(release('Movie.2020.1080p.BluRay.x265-GRP', 500, null), preferences)!).toBeGreaterThan(0);
  });

  it('works with only a size cap set', () => {
    expect(releaseScore(release('Movie.2020.BluRay-GRP', 0), prefer({ maxSizeGb: 10 }))).toBe(10);
  });
});
