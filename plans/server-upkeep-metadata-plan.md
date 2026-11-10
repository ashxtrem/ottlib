# Server upkeep and richer title data

Approved by the user (2026-11-10: "Approved").
Issue: #58
Came from a review of HolyArrs (github.com/HolyArrs/HolyArrs, AGPL: ideas only, no code) on 2026-11-10. This is plan 1 of 3;
`plans/web-browse-polish-plan.md` and `plans/android-browse-polish-plan.md` build on what it adds and run after it merges.

## 1. Why
- **No backup of the library database.** `createDatabase` opens `library.sqlite` and runs 23 migrations on every start
  (packages/server/src/db/db.ts:30-56) with no copy taken first; there is no `user_version` or schema table, so the server
  cannot even tell that an update changed the schema. The upgrade docs only say to copy `config/` and `data/` (docs/install.md:33-35).
- **Nothing tells the user what is broken.** There is no health endpoint (only `GET /api/scan/status`, routes/scan.ts:7, and
  `GET /api/transcode/encoders`, routes/hls.ts:55). A missing ffmpeg, an unplugged library drive, a rejected TMDb key or a
  full disk each surface only when something fails.
- **The layering rules are prose.** AGENTS.md sets layer order, the 700-line cap and "no barrels"; CI runs build and tests
  only (.github/workflows/ci.yml:28-31) and no test checks any of it. Three routes already import repositories as values
  (routes/library.ts:4, routes/playbackProgress.ts:3, routes/scan.ts:2).
- **Title data is thin.** TMDb details are fetched with `append_to_response: 'credits,external_ids'` only
  (providers/metadata/tmdbProvider.ts:28) and cast keeps names only (tmdbProvider.ts:34). Collections, cast photos, title
  logos and trailers are never read; OMDb's `Ratings` array is ignored (omdbProvider.ts:26 keeps `imdbRating` only).
- **Torrent results have no preference score.** `processResults` sorts by seeders then file name
  (services/torrentSearchService.ts:118).

## 2. Decisions
User (2026-11-10):
- **In scope:** operations (backups, health checks, CI structure checks), richer titles (outside ratings, cast photos, title
  logo, collections, a "new" mark), trailers and release scoring.
- **Deletes stay permanent.** No holding folder; `libraryDeletionService.deleteCopy` is untouched.
- **Kid profiles are out.** No certifications are fetched or stored.
- **Cast becomes photo cards that open the actor-filtered library.** No person page and no filmography endpoint.

My calls (change any at approval):
- **Backup trigger: `PRAGMA user_version` against a `SCHEMA_VERSION` constant.** Picked because migrations are idempotent
  `ensure*` functions with no version record. Rejected: comparing the app version (the server always reports 0.1.0 from
  package.json, serverInfoService.ts:5).
- **Backup copy: `VACUUM INTO`.** Synchronous, safe under WAL, one file. Rejected: copying `library.sqlite` (misses the WAL).
- **Retention:** newest 3 pre-update, 7 daily, manual ones until deleted. Daily at 04:00, `backupEnabled` default on.
- **Backups cover the database only.** Posters, logos and subtitles are re-downloadable.
- **No backup download endpoint.** The file holds the TMDb and qBittorrent secrets in plain text; it stays in `data/backups`.
- **Restore is loopback-only and applies on the next start.** Settings routes have no owner check (routes/settings.ts:6-9),
  so a destructive action is limited to the server PC, like reveal and play-local (routes/loopback.ts:2-4).
- **Health runs on demand with a 60 s cache**, not on a timer. Each check times out after 5 s.
- **Update check is a health check, daily, behind `updateCheckEnabled` (default on).** Version comes from the bundle's
  `VERSION` file (scripts/package-server.mjs:37); running from source reports "running from source" and makes no call.
- **Structure rules are a vitest file, not ESLint.** No new dependency; runs in the existing `npm test`.
- **Outside ratings come from a new `RatingsProvider` interface**, implemented by OMDb. Rejected: a method on
  `MetadataProvider` (TMDb cannot supply it). Re-fetched at most every 30 days per title; on OMDb's "Request limit reached"
  the run stops asking and notes it.
- **Artwork is cached locally** (logos, 8 cast photos per title, posters of missing collection films), like posters today.
- **"New" = added in the last 14 days, unwatched, not missing, and added more than a day after the library's first title.**
  Server-computed so all three clients agree; the last clause stops a first scan marking everything new.
- **Existing titles are backfilled automatically, once, at server start**, by starting the existing metadata refresh for
  titles with no extras yet. Follows the user's earlier call for letterbox detection (automatic backfill).
- **New queries go in new repository files.** `movieRepository.ts` is 554 lines; the cap is 700.
- **Release score is null until a preference is set**, so nothing changes for users who set none.

## 3. Backups
- `db/backupFile.ts`: `vacuumInto(db, path)`, `readSchemaVersion(db)`, `writeSchemaVersion(db, n)`, and `SCHEMA_VERSION`
  (24 after this plan; every later migration bumps it).
- `db/db.ts`: `createDatabase` gains an option `backupBeforeMigrate`, false by default and passed as true only from
  index.ts:7. About 50 tests and `scripts/resetPins.ts:15` also call `createDatabase`, and one test builds a `movies` table
  at `user_version` 0 (db/migrations/020_profile_scope.test.ts:20-24); none of them should write backups. With the option
  on, after opening and before the first migration, when the `movies` table exists and `user_version` is below
  `SCHEMA_VERSION`, write `data/backups/pre-update-<YYYYMMDD-HHmmss>.sqlite` and prune to 3. After the last migration
  `user_version` is always set. A fresh install takes no backup.
- `db/restorePending.ts`: `applyPendingRestore(appDataPath)`, called from index.ts before `createDatabase` (index.ts:7). It
  reads `data/restore-pending.json`, moves `library.sqlite` with its `-wal` and `-shm` to
  `backups/before-restore-<stamp>.sqlite`, copies the chosen backup in and deletes the marker. A missing backup file leaves
  the database alone and deletes the marker.
- `repositories/backupRepository.ts`: the one place that runs `VACUUM INTO` at runtime.
- `services/backupService.ts`: `list()`, `create(kind)`, `remove(name)`, `requestRestore(name)`, `prune()`. Names match
  `^(pre-update|daily|manual|before-restore)-\d{8}-\d{6}\.sqlite$`; anything else is a 400. `requestRestore` opens the file
  read-only and checks `PRAGMA quick_check` and that `movies` exists before writing the marker.
- `services/backupScheduler.ts`: node-cron `0 4 * * *` when `backupEnabled`, same refresh/stop shape as
  `SchedulerService` (services/schedulerService.ts:8-13); wired next to it (app.ts:121, app.ts:150).
- `routes/backups.ts`: `GET /api/backups`, `POST /api/backups`, `DELETE /api/backups/:name`,
  `POST /api/backups/:name/restore` (loopback-only, 403 elsewhere). Restore answers `{ status: 'pending-restart' }`.
- Shared: `packages/shared/src/backups.ts` (`backupSchema`: name, kind, sizeBytes, createdAt), exported from index.ts;
  `backupEnabled` in `settingsSchema` (index.ts:164-185) and `defaultSettings` (config/defaults.ts:12-32).

## 4. Health checks
- `services/health/HealthCheck.ts`: `interface HealthCheck { id: string; label: string; run(): Promise<HealthResult> }`,
  `HealthResult = { state: 'ok' | 'warn' | 'fail'; message: string; fix?: string }`. One file per check under
  `services/health/checks/`, registered in order in `services/health/healthChecks.ts` (AGENTS.md plug-in pattern).

| Check | ok | warn | fail |
|---|---|---|---|
| `library-folders` | every folder readable | – | a folder is gone or unreadable (names it) |
| `disk-space` | room on the data drive | under 1 GB free | under 256 MB free |
| `ffmpeg` | found | not found: transcoding is off | – |
| `tmdb-key` | key accepted | no key set | key rejected |
| `qbittorrent` (only when torrent search is on) | connects | – | cannot connect or sign in |
| `backups` | a backup in the last 8 days | none yet, or older | the last daily backup failed |
| `title-extras` | none pending | N matched titles have no extras yet | – |
| `update` | newest, or running from source | a newer release is out | – |

- `disk-space` uses `fs.promises.statfs` on `appDataPath` (Node 22 in CI, ci.yml:26). `ffmpeg` uses `FfmpegLocator.locate()`
  (providers/transcode/ffmpegLocator.ts:63-66). `tmdb-key` reuses the test behind `POST /api/settings/tmdb/test`
  (routes/settings.ts:9). `update` calls `api.github.com/repos/ashxtrem/ottlib/releases/latest` at most once a day.
- `services/health/healthService.ts`: runs all checks in parallel, 5 s timeout each (a timeout is `warn`), caches 60 s;
  `run(fresh)` skips the cache.
- `routes/health.ts`: `GET /api/health` and `GET /api/health?fresh=1` → `{ checkedAt, checks: [{ id, label, state, message, fix }] }`.
- `config/appVersion.ts`: reads `VERSION` from the working directory, else null.
- `scripts/doctor.ts`: prints one `OK` / `WARN` / `FAIL` line per check with its fix and exits 1 on any fail. npm script
  `doctor` beside `reset-pins` (packages/server/package.json:10); `doctor.bat` / `doctor.sh` in `scripts/bundle/`, copied by
  `scripts/package-server.mjs` next to the start launchers (package-server.mjs:33-35).

## 5. Structure checks
`packages/server/src/structure.test.ts`, run by the existing `npm test`. Rules 1, 2 and 4 skip `*.test.ts`: route tests
import `../db/db.js` and repositories (routes/auth.test.ts:6, routes/credits.test.ts:7-8) and 21 test files call
`.prepare(` to set up data (e.g. services/libraryDeletionService.test.ts:16). Outside tests the tree is clean today:
`.pragma(` appears only at db/db.ts:31-33.
1. No file in `routes/` imports from `../db/`.
2. No file in `routes/` imports a value from `../repositories/` (type-only imports pass). Allowlist: library.ts,
   playbackProgress.ts, scan.ts. The test also fails when an allowlisted file no longer needs its entry, so the list only shrinks.
3. No file under `services/` imports `fastify`.
4. `.prepare(` and `.pragma(` appear only under `repositories/` and `db/`.
5. No `.ts`/`.tsx` under `packages/*/src` and no `.kt` under `apps/android/*/src` (and `core/*/src`) is over 700 lines.
6. The only `index.ts` files under `packages/*/src` are `packages/server/src/index.ts` and `packages/shared/src/index.ts`.

## 6. Richer title data
- Migration `024_title_extras.ts` (`ensureTitleExtras`, pattern of 023_credits.ts:21-26): on `movies` add `cast_members_json`,
  `logo_file`, `collection_id`, `collection_name`, `trailer_key`, `ratings_json`, `ratings_fetched_at`, `extras_fetched_at`;
  create `collections (collection_id INTEGER PRIMARY KEY, name, parts_json, fetched_at)`. `cast_json` stays as names: the
  actor filter reads it (movieRepository.ts:455).
- `MetadataProvider.ts` (MetadataProvider.ts:3-6): `MovieMetadata` gains optional `castMembers: { name, photoUrl }[]`,
  `logoUrl`, `collection: { id, name }`, `trailerKey`, `ratings`.
- `tmdbProvider.ts`: `append_to_response: 'credits,external_ids,images,videos'` with `include_image_language=en,null`. Map
  the first 8 cast with `profile_path` (w185), the top English or language-less PNG logo (w500), `belongs_to_collection`,
  and the trailer key: YouTube, type Trailer, official first, else Teaser. New `getCollection(id)` → `/collection/{id}` parts.
- `providers/metadata/RatingsProvider.ts`: `interface RatingsProvider { name: string; getRatings(imdbId: string): Promise<OutsideRating[]> }`,
  `OutsideRating = { source: 'imdb' | 'rottenTomatoes' | 'metacritic'; value: number; max: number }`.
  `ratingsProviders.ts` returns OMDb when its key is set (same gate as metadataProviders.ts:7). `omdbProvider.ts` parses
  `Ratings` ("8.8/10", "87%", "74/100").
- `posterCacheService.ts` (cache at :10): its `kind` is the literal `'posters' | 'backdrops'` today and gains `'logos'` and
  `'people'`; with `refresh` false an existing file is already skipped (:10-17), which is what shares cast photos between
  titles. The served folders come from `config/mediaStatic.ts:2` (`['posters', 'backdrops']`), which gains the two new
  ones so `routes/mediaStatic.ts` (:11-14) serves `/media/logos/:file` and `/media/people/:file`.
- `repositories/movieExtrasRepository.ts`: `applyExtras(id, extras)`, `applyRatings(id, ratings)`, `extrasFor(id)`,
  `idsMissingExtras()`, `ratingsDue(id, days)`.
- `metadataMatchService.saveMetadata` (metadataMatchService.ts:308-321): after `applyMetadata`, cache logo and cast photos,
  call `applyExtras`, then ask ratings when an IMDb id exists and they are due. A ratings failure never fails the save.
- Backfill: after the server starts listening, when `idsMissingExtras()` is non-empty and no run is active, start the
  existing metadata refresh for those ids (the service behind `POST /api/movies/metadata-refresh`, routes/library.ts:31-36).
- Fresh mark: `fresh: 'new' | null` computed in the list and detail mapping of `movieRepository` from `added_at`
  (001_initial.ts:21), the profile's watched state and `missing`; `FRESH_DAYS = 14` in config/defaults.ts.

## 7. Collections
- `repositories/collectionRepository.ts`: `get(id)` / `put(id, name, parts)`, shaped like recommendationSignalRepository.ts:8-18.
- `services/collectionService.ts`: `forMovie(movieId)` → null when the title has no collection; else owned titles (same
  `collection_id`, not missing, year order) and missing parts (TMDb ids not among owned `provider_id`s). Parts are cached
  30 days; a fetch gets 4 s, and on failure the answer is owned titles with `missing: []`. Posters of up to 20 missing
  parts are cached locally.
- `routes/collections.ts`: `GET /api/movies/:id/collection` → `{ id, name, owned: MovieListItem[], missing: [{ tmdbId, title, year, posterUrl }] }`, 404 with no collection.
- `GET /api/movies` accepts `collection=<id>`: the route (routes/library.ts:20-25) hands the query to
  `services/libraryService.ts:9`, which calls `movieRepository.listSummaries` with a `MovieListQuery`
  (movieRepository.ts:56); all three gain the field. `GET /api/movies/filter-options` (routes/library.ts:26) gains
  `collections: [{ id, name, count }]` for collections with 2 or more owned titles.
- That response is built or pinned in several places that change with it: `movieFilterOptions` in the shared index
  (:197-202), movieRepository.ts:57 and :106, movieRepository.test.ts:78 and :203 (exact `toEqual`), the `filter-options`
  fixture (nativeClient.test.ts:319), the web client's own builder for shelves (packages/client/src/utils/shelfMovieFilters.ts:23-28
  and its test :27) and a literal in LibraryFilters.test.tsx:13, and Kotlin's `MovieFilterOptions` (MovieListItem.kt:31-37).

## 8. Release scoring
- Settings: `torrentPreferredResolution` (`'2160p' | '1080p' | '720p' | null`), `torrentPreferredCodec`
  (`'hevc' | 'h264' | 'av1' | null`), `torrentMaxSizeGb` (number or null), all default null.
- `services/torrent/releaseScore.ts`, pure: 0–100. Resolution: exact 50, one step below 25, above 15. Codec match 20.
  Seeders up to 20 on a log scale. BluRay or WEB source 10. Over the size cap scores 0. Weights live in config/defaults.ts
  beside the tag regexes (defaults.ts:4-8).
- `torrentSearchService.processResults` (:90-118) attaches `score: number | null` and `bestMatch: boolean` (the single top
  score above 0) next to `quality` (:108). Server order stays seeders-first.
- `repositories/movieUpgradeRepository.ts` + `GET /api/torrents/upgrade-candidates` behind the same 404 gate
  (routes/torrents.ts:11): titles below the preferred resolution, or in an old codec (MPEG-4/Xvid, MPEG-2, VC-1, WMV, read
  from `movies.video_codec`, 006_media_probe.ts:11), as `{ movie: MovieListItem, reason: 'resolution' | 'codec' }`, by
  title, limit 200.

## 9. API and contract
- `packages/shared/src/index.ts`: `movieSchema` (:82-110) gains `castMembers`, `logoUrl`, `ratings`, `collection`,
  `trailerKey`, `fresh`; `movieListItemSchema` (:112-127) gains `fresh`. `packages/shared/src/torrent.ts` (:12-24) gains
  `score` and `bestMatch`. New files `backups.ts`, `health.ts`, `collections.ts`.
- Fixtures: re-record the ten movie-shaped ones (`movie`, `movie-unmatched`, `movie-list-page`, `continue-watching`,
  `queued-next`, `next-episode`, `completed-episode`, `recommendations`, `shelf-detail`, `filter-options`) with
  `npx vitest run -u` in `packages/server` (nativeClient.test.ts:58-59, :182-323); add `movie-collection`.
- Kotlin, same change: `Movie.kt` (:7-36) and `MovieListItem.kt` (:7-22) get the new fields with defaults,
  `MovieFilterOptions` (:31-37) gets `collections`, and a new `MovieCollection.kt`. `ContractFixturesTest` decodes
  strictly (ContractFixturesTest.kt:17) and fails on any fixture missing from its map (:20-62), so `movie-collection` is
  added there. `ShelfDetail` and `Recommendation` reuse `Movie` (Shelf.kt:28, Recommendation.kt:8) and need no edit.
- Web client: the new required fields break typed literals in its tests (PosterCard.test.tsx:7, shelfMovieFilters.test.ts),
  so those are updated in the same task and `npm run build` must pass for every workspace. No client behaviour changes here.
- No `apiVersion` bump: every change is additive and installed apps ignore unknown keys (core/network/OttlibJson.kt:7).

## 10. Tests to change or add
- New, beside the code: backupFile, restorePending, backupService, routes/backups, healthService (cache, timeout, one test
  per check), routes/health, structure, 024_title_extras, movieExtrasRepository, collectionService, releaseScore, and
  tmdbProvider and omdbProvider mapping tests (neither provider has a test file today).
- Extend: metadataMatchService.test.ts (extras saved; a "Request limit reached" error, pinned in the run notice at
  :206-214, now also stops ratings for the rest of the run, which is new behaviour), torrentSearchService.test.ts (its
  `toMatchObject` at :27-28 tolerates the new fields), movieRepository.test.ts (:78, :203), nativeClient.test.ts.
- Tests that build settings from `defaultSettings` must still pass with the new keys: settingsService.test.ts:5 and :50,
  qbittorrentClient.test.ts:5-8, subtitleProviders.test.ts:2, recommendationService.test.ts:6.

## 11. Tasks
T1 → T2 → T3 and T1 → T5 → T6 → T7 → T8 run in order because they share `db.ts`, `app.ts`, `defaults.ts` and the shared
index. T4 touches only its own file and can run alongside anything. T3 and T5 can run alongside each other.

| Task | Files | Spec | Depends on | Checks |
|---|---|---|---|---|
| T1 Pre-update backup and restore-on-start | db/db.ts, db/backupFile.ts (+test), db/restorePending.ts (+test), index.ts | full | – | with `backupBeforeMigrate` a database at `user_version` 0 with a `movies` table gets a `pre-update-*.sqlite` before migrations; a fresh database gets none; without the option no file is written (020_profile_scope.test.ts and resetPins unaffected); `user_version` equals `SCHEMA_VERSION` after start; a pending restore swaps the file and keeps `before-restore-*` |
| T2 Backup API and daily schedule | repositories/backupRepository.ts, services/backupService.ts (+test), services/backupScheduler.ts, routes/backups.ts (+test), shared/src/backups.ts, shared/src/index.ts, config/defaults.ts, app.ts | full | T1 | `POST /api/backups` creates a file that opens as SQLite; a bad name is a 400; restore from a non-loopback address is a 403; pruning keeps 7 daily and every manual one; turning `backupEnabled` off stops the cron task |
| T3 Health checks and doctor | services/health/** (+tests), routes/health.ts (+test), shared/src/health.ts, shared/src/index.ts, config/appVersion.ts, config/defaults.ts, app.ts, scripts/doctor.ts, packages/server/package.json, scripts/bundle/doctor.bat, scripts/bundle/doctor.sh, scripts/package-server.mjs | partial | T2 | `GET /api/health` lists every registered check with a state; a check that hangs reports `warn` within 5 s; a second call inside 60 s runs no check, `?fresh=1` does; `update` makes no request when `VERSION` is absent or the setting is off; `npm run doctor` exits 1 on a fail |
| T4 Structure checks | packages/server/src/structure.test.ts | full | – | passes on today's tree with the 3-file allowlist and `*.test.ts` skipped for rules 1, 2 and 4; fails when a route gains a value import of a repository; type-only imports (plays.ts:4, recommendations.ts:2) pass; fails on a 701-line file; fails when an allowlisted file is clean |
| T5 Title extras: migration, providers, save | db/migrations/024_title_extras.ts (+test), db/db.ts, providers/metadata/MetadataProvider.ts, tmdbProvider.ts, omdbProvider.ts, RatingsProvider.ts, ratingsProviders.ts, new tmdbProvider.test.ts and omdbProvider.test.ts, services/posterCacheService.ts, config/mediaStatic.ts, repositories/movieExtrasRepository.ts (+test), services/metadataMatchService.ts (+test) | partial | T1 | the migration is idempotent; a TMDb match stores 8 cast members, logo, collection and trailer key; ratings parse to value and max; a ratings failure leaves the save succeeded; ratings are not re-asked inside 30 days; `/media/people/x.jpg` is served |
| T6 Extras in the API, contract and backfill | shared/src/index.ts, repositories/movieRepository.ts, services/health/checks/titleExtras.ts, services/health/healthChecks.ts, app.ts, config/defaults.ts, routes/nativeClient.test.ts, contract/fixtures/*, apps/android/core/model Movie.kt and MovieListItem.kt, typed literals in packages/client/src/components/PosterCard.test.tsx and utils/shelfMovieFilters.test.ts | full | T3, T5 | `GET /api/movies/:id` returns the six new fields; `fresh` is `new` only inside 14 days, unwatched, and after the first-day window; the nine movie-shaped fixtures are re-recorded and `ContractFixturesTest` passes; `npm run build` passes for every workspace; the backfill starts once when titles lack extras and not while a run is active |
| T7 Collections | repositories/collectionRepository.ts, services/collectionService.ts (+test), routes/collections.ts, routes/library.ts, services/libraryService.ts, repositories/movieRepository.ts (+test), shared/src/collections.ts, shared/src/index.ts, app.ts, contract fixtures `movie-collection` and `filter-options`, apps/android/core/model MovieCollection.kt, MovieListItem.kt (`MovieFilterOptions`) and ContractFixturesTest.kt, packages/client/src/utils/shelfMovieFilters.ts (+test), packages/client/src/components/LibraryFilters.test.tsx | full | T6 | a title in a collection returns owned and missing parts; no collection is a 404; a TMDb failure returns owned with `missing: []`; `?collection=` filters the list; filter-options lists only collections with 2 or more owned; movieRepository.test.ts:78 and :203 updated; `ContractFixturesTest` maps `movie-collection`; `npm run build` passes for every workspace |
| T8 Release score and upgrade candidates | services/torrent/releaseScore.ts (+test), services/torrentSearchService.ts (+test), shared/src/torrent.ts, shared/src/index.ts, config/defaults.ts, repositories/movieUpgradeRepository.ts, routes/torrents.ts | full | T7 | with no preference every `score` is null and `bestMatch` false; a 1080p preference ranks a 1080p release above a 720p one with equal seeders; over the size cap scores 0; candidates answer 404 while torrent search is off; the four tests that build settings from `defaultSettings` (§10) still pass |

## 12. Risks and known gaps
- **OMDb's free key allows 1,000 requests a day.** A large library's backfill will hit it; ratings then fill in over later
  refreshes. Stated in the run notice.
- **The backfill re-runs the full metadata refresh per title**, so it also re-reads titles and artwork already stored.
  Concurrency stays at the job's existing 4 (metadataMatchService.ts:24).
- **Cast photos add up to 8 small files per title** under `data/people`, shared between titles by file name.
- **`GET /api/server-info` still reports 0.1.0.** Only the update check reads `VERSION`; changing server-info is left out.
- **Restore needs a manual restart.** The server does not restart itself.
- **Titles matched through OMDb only get ratings**, not logo, cast photos, collection or trailer.

## 13. Progress log
- 2026-11-10: plan written and approved.
