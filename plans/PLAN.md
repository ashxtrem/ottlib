# Ottlib — Personal Movie Library Web App

## Context

You want a self-hosted web app to organize your local movie collection: scan folders on your PC, pull metadata/cover art (Hollywood + Bollywood coverage), browse a library UI, and play movies either on the PC itself or streamed to your phone (mainly Android) over LAN — all with no cloud dependency, no auth (trusted home network), indexing done on the PC.

## Tech Stack

- **Backend**: Node.js + Fastify (better streaming/schema ergonomics than Express)
- **Frontend**: React + Vite SPA
- **Database**: SQLite (`better-sqlite3`) — single local file, stores movies, folders, settings, scan history
- **Metadata**: TMDb (primary, strong Hollywood + Bollywood/global coverage) with OMDb as fallback when TMDb has no match
- **No auth** — trusted home LAN only
- Fixed, user-configurable port; configurable list of recognized video extensions (default: mp4, mkv, avi, mov, m4v, wmv, flv, webm)

## Project Structure (npm workspaces monorepo)

```
E:\AI\lib/
├── package.json                     # workspaces root
├── config/config.example.json       # bootstrap-only: {port, appDataPath}; copied to config.json on first run if absent
├── packages/
│   ├── shared/          # TS types/zod schemas shared by server + client (Movie, Settings, ScanStatus, etc.)
│   ├── server/
│   │   └── src/
│   │       ├── index.ts, app.ts                     # Fastify bootstrap, static client serving
│   │       ├── config/configStore.ts, defaults.ts    # bootstrap config + immutable defaults
│   │       ├── db/db.ts, migrations/                 # better-sqlite3, WAL mode
│   │       ├── repositories/                          # one typed repository per table
│   │       │   ├── movieRepository.ts, folderRepository.ts
│   │       │   └── settingRepository.ts, scanRunRepository.ts
│   │       ├── services/                              # orchestration/business logic only
│   │       │   ├── scanService.ts, metadataMatchService.ts, schedulerService.ts
│   │       │   ├── streamService.ts, playbackService.ts, posterCacheService.ts
│   │       │   └── scanner/walker.ts, scanner/titleParser.ts
│   │       ├── providers/metadata/                    # registered provider implementations
│   │       │   ├── MetadataProvider.ts, tmdbProvider.ts, omdbProvider.ts, metadataProviders.ts
│   │       ├── providers/playback/                    # registered handoff strategies
│   │       │   ├── PlaybackHandoff.ts, localLaunch.ts, lanPlaylist.ts, androidIntent.ts
│   │       └── routes/library.ts, folders.ts, settings.ts, scan.ts, stream.ts, playback.ts
│   └── client/
│       └── src/
│           ├── pages/LibraryPage.tsx, MovieDetailPage.tsx, SettingsPage.tsx
│           ├── components/PosterGrid.tsx, PosterCard.tsx, PlayButton.tsx, ScanStatusBanner.tsx
│           └── hooks/useMovies.ts, useSettings.ts, useScanStatus.ts (TanStack Query)
```

In production, `npm run build` builds the client to static files; the Fastify server serves both the API and the built client on one port.

## Backend Design

### Folder scanning (`walker.ts`)
Recursive `fs.promises.readdir` walk (no extra dependency), filters by the configured extension list, does not follow symlinks, and emits candidate files incrementally via async generator. Default ignored directories (`.git`, `@eaDir`, sample/extras) live in `config/defaults.ts`; user-configurable ignored-folder patterns can extend them without inline conditionals. Each configured root and discovered file path is resolved and normalized before use, and a file is accepted only if it remains within its configured root.

### Title/year parsing (`titleParser.ts`)
Custom regex/heuristic parser (no reliable off-the-shelf library for this): normalize separators, extract a plausible release year from a bounded release-year range, strip known release tags (resolution/source/codec/audio/group), and fall back to the parent folder name for generic filenames. Store `raw_filename`, `parsed_title`, `parsed_year`, and an optional `title_override` for manual correction. Unit-test against a table of ~20-30 real-world-style filenames, including ambiguous years and generic filenames.

### Metadata matching (`matcher.ts`)
`MetadataProvider` defines shared `search(title, year?)` and `getDetails(providerId)` contracts plus a normalized metadata shape. The registered provider list tries TMDb first, then OMDb, without provider-specific branching in the service. TMDb search uses the year when available, scores title/year matches, and only accepts a result above a defined confidence threshold; otherwise the next provider is tried. A selected candidate is then fetched with full details and credits.

Unmatched files remain in the library (title = cleaned filename, `metadata_status = 'unmatched'`). Store the provider name and provider item ID with the normalized result, plus metadata status/error and matched-at timestamp. Small delay between lookups stays within provider rate limits. Posters/backdrops download once to `<appDataPath>/posters/` and are served from `/media/`; mutable runtime data never lives under `packages/`. Matching is skipped only when the canonical path, size, and mtime are unchanged. The detail UI includes manual title override plus search/rematch, which clears the prior result/cache association and avoids permanently retaining a weak automatic match.

### SQLite schema
Migrations define the complete schema, with `PRAGMA foreign_keys = ON`, WAL mode, and a busy timeout. `folders` stores a canonical absolute root path, enabled state, and timestamps. `movies` stores `folder_id`, canonical absolute path (unique), size, mtime, `last_seen_at`, raw/parsed/override titles, resolved metadata and provider ID, and missing state — **no `watched` column here**, since watched state is per-device (see below). `settings` stores validated key/value JSON for API keys, extensions, ignored patterns, and schedule configuration. `scan_runs` stores scope, start/end time, status, counters, and error summary for the progress UI. Add indexes for library listing/filtering and folder reconciliation, including `title` and `missing`.

**Per-device watched state**: no login exists, so "device" is identified by an opaque `device_id` (UUID) the client generates once and persists in `localStorage`, sent on relevant requests via an `X-Device-Id` header. A separate `movie_watch_state` table holds `(movie_id, device_id, watched, updated_at)` with a composite primary key on `(movie_id, device_id)` — this keeps the `movies` table itself device-agnostic and lets the watched flag scale to per-device without touching core movie rows. Library list/detail responses join in the requesting device's watched state (defaulting to unwatched if no row exists yet for that device+movie). There is intentionally no cross-device merge/sync — "watched on phone" and "watched on PC" are independent, matching the choice to track them separately.

Each table has one typed repository file; SQL is confined to repositories. Scanning writes in transactions where appropriate. Files are marked missing only after their specific root finishes successfully. A failed, inaccessible, or disconnected root records a failed run and leaves prior files intact.

### REST API
```
GET        /api/movies                          — paginated/filterable library list (watched reflects requesting device)
GET/PATCH  /api/movies/:id                      — detail; title-override updates
PUT        /api/movies/:id/watch-state          — set watched/unwatched for the requesting device (X-Device-Id)
POST       /api/movies/:id/rematch              — explicitly re-search and replace metadata
POST       /api/movies/:id/play-local           — loopback-only local-player launch
POST       /api/movies/:id/reveal               — loopback-only Explorer reveal
GET/POST   /api/folders                          — list/create scan roots
DELETE     /api/folders/:id                      — remove a root; retain movie records as missing
GET/PUT    /api/settings                        — API keys (masked on read), extensions, schedule
POST       /api/scan   GET /api/scan/status      — trigger + poll (idempotent, no overlapping runs)
GET/HEAD   /api/stream/:id                       — range-request file stream (section below)
GET        /api/stream/:id/playlist.m3u          — LAN media-player handoff file
GET        /api/server-info                      — LAN IP(s) + port, for the "connect from phone" helper
GET        /media/posters/:file, /media/backdrops/:file
```

Routes validate request and response shapes with schemas from `packages/shared`; they call services only, and no route or service contains raw SQL. `POST /api/scan` returns the currently active scan run when one exists instead of starting another. Settings updates never treat a masked API-key value as a replacement key. Every request that reads or writes watch state must carry an `X-Device-Id` header (client-generated UUID, validated server-side as a well-formed UUID); requests missing/malformed it get a `400` on the watch-state endpoint and default to "unwatched" on read endpoints like `/api/movies`.

### Streaming endpoint — `GET /api/stream/:id`
Pure byte-range file server, no transcoding in v1 (matches your call to add transcoding later only if needed):
- Resolve the movie from the DB, re-check the canonical file path remains within its configured root, and `fs.stat` it; missing/unavailable files return a clear `404`.
- `Content-Type` comes from a dedicated extension map; every response includes `Accept-Ranges: bytes`. Send safe `Content-Disposition`, `Last-Modified`, and an ETag/cache validator where practical. Media cache requests likewise resolve names beneath the cache root and reject traversal.
- Support `GET` and `HEAD`. No `Range` header produces `200` with the full `Content-Length`; a valid single `Range: bytes=start-end` (including open-ended and suffix forms) produces `206` with correct `Content-Range` and `Content-Length`.
- Reject malformed, multi-range, or unsatisfiable range requests deterministically; an unsatisfiable request returns `416` and `Content-Range: bytes */<size>`.
- Use `fs.createReadStream(path, { start, end })` for `GET` bodies and clean it up on client abort/seek-away.

### Playback handoff — local PC vs LAN/Android (the two paths you asked to design carefully)

The browser selects the LAN/Android handoff based on its user agent, while the server authorizes local launching from the request socket address. Fastify proxy trust remains disabled unless a trusted reverse-proxy deployment is explicitly configured; loopback checking handles `127.0.0.1`, `::1`, and IPv4-mapped forms such as `::ffff:127.0.0.1`.

**Local (on the PC itself, request from loopback):**
- Play sends `POST /api/movies/:id/play-local`. After loopback and path-containment validation, the local-launch playback strategy starts the file in its default OS handler. Do not interpolate a path into `child_process.exec`; use a hardened Windows launcher with argument-based process invocation and only the validated stored path.
- A secondary "Show in folder" action sends `POST /api/movies/:id/reveal`, which uses a separately validated Windows Explorer launch to highlight the file.
- A LAN client receives `403` from local-launch endpoints, preventing a phone request from opening files on the PC unexpectedly. Using `POST` prevents accidental browser prefetch/navigation from launching playback.

**LAN / Android (request from a non-loopback address):**
- Play offers a tiny `.m3u` file (`GET /api/stream/:id/playlist.m3u`, `Content-Disposition: attachment`) whose single line is the encoded absolute `/api/stream/:id` URL. This is the primary mechanism for PC-to-PC LAN access; the fallback is opening the downloaded file in a registered player.
- On Android, client-side user-agent detection selects an encoded `intent://` URL targeting `type=video/*` with `android.intent.action.VIEW`. It includes an encoded `S.browser_fallback_url` pointing to the plain stream URL so an unsupported device can load it in-browser. The Android playback strategy is responsible for URL construction and encoding; it does not rely on the server inferring Android from `remoteAddress`.
- iOS (not a primary target, but shouldn't break): falls back to the plain direct stream link.

| Context | Mechanism | Fallback |
|---|---|---|
| Local PC (loopback request) | Server shells out to open file directly in default app | "Show in folder" button |
| LAN (PC/laptop over Wi-Fi) | `.m3u` download, auto-opens registered player | Double-click downloaded file |
| Android | `intent://` app-chooser link | `browser_fallback_url` → plays/loads in Chrome |

Both LAN mechanisms should be validated on a real Android device (VLC/MX Player installed) and from a second PC on the network early in implementation, since they depend on OS/browser association behavior outside the app's direct control.

### Scheduled rescan (`scheduler.ts`)
The Settings UI stores a validated cron expression (rather than an ambiguous numeric "interval") and an enabled flag. A `node-cron` job is created, destroyed, and recreated when those settings change. It calls the same `scanService.runScan()` used by the manual trigger, writes to `scan_runs`, and returns the active run rather than overlapping it. A duration-based schedule is a future alternative only if implemented with a duration scheduler rather than `node-cron`.

## Frontend Design

- **Routes**: `/` (library grid, search, watched/unwatched filter, sort), `/movie/:id` (detail: backdrop, poster, plot, cast, genres, rating, Play + Show-in-folder buttons, watched toggle, title override/rematch), `/settings` (scan folders, extensions, ignored patterns, TMDb/OMDb keys, cron schedule, server info panel showing LAN IP:port to type into your phone)
- **Device identity**: on first load, a `useDeviceId` hook generates a UUID (`crypto.randomUUID()`) if none is in `localStorage`, persists it, and an API-client interceptor attaches it as `X-Device-Id` on every request. Watched state shown/toggled in the UI is always this device's own state — there is no "watched on other devices" indicator in v1.
- **State**: TanStack Query for all server state (movies, settings, scan status with polling that auto-stops when a scan finishes) — no separate global state library needed
- **Responsive**: Tailwind utility classes implement the responsive poster grid (including an arbitrary `auto-fill/minmax` grid template if needed), touch-friendly tap targets, and dark-mode variants; no component CSS files. The same SPA serves both desktop and Android Chrome from one origin.

## Config Storage

Only the server **port** and `appDataPath` live in a minimal `config/config.json` (needed before DB initialization). On first run, the server copies `config/config.example.json` when the real file is absent. The database path, poster cache, and any logs derive from `appDataPath`; they are not written into the source tree. Everything else editable from the Settings UI — TMDb/OMDb API keys, scan folders, extensions, ignored patterns, and cron schedule — lives in SQLite `settings`/`folders` tables and takes effect without restart. Port changes require restart and are clearly messaged in the UI.

Because there is intentionally no authentication, the server binds to `0.0.0.0` for the LAN use case and the UI warns that every device on the local network can browse and stream the configured roots. The setup guidance keeps Windows Firewall scoped to private networks.

## Setup / Run

1. Node.js 20+, `npm install` at repo root
2. On first start, review the generated `config/config.json` and adjust port/app-data path if needed
3. `npm run build && npm start` (or `npm run dev` for local dev with Vite proxying to Fastify)
4. First run: open `http://localhost:8080`, go to Settings → enter TMDb key (+ optional OMDb key) → add scan folder(s) → "Rescan now"
5. Settings page's "Server Info" panel shows your LAN IP:port to type into your Android phone's browser (same Wi-Fi network required)
6. Allow the app through Windows Firewall when prompted (needed for phone access)

## Verification Plan

Use Vitest for unit and service tests and Fastify `inject` for API integration tests. Keep tests adjacent to the code they cover.

1. **Title parsing**: unit tests over ~20-30 sample filenames (varied separators/resolutions/codecs/missing years) asserting expected `{title, year}`.
2. **Migrations and repositories**: create a fresh database, run migrations, validate foreign keys/unique canonical paths, and exercise each repository's CRUD and filtering behavior.
3. **Scan reconciliation**: scan a test root containing dummy files, change/delete files, and confirm only a successfully completed root marks unseen files missing. Simulate an inaccessible root and confirm existing records remain intact and the run is failed.
4. **Metadata providers**: mock TMDb and OMDb; verify high-confidence TMDb success, low-confidence TMDb rejection then OMDb fallback, unmatched storage, and manual override/rematch. Confirm poster files cache under the configured app-data directory.
5. **Range streaming**: test `GET` and `HEAD`, no-range `200`, valid fixed/open-ended/suffix ranges with `206`, malformed and multi-range policy, and unsatisfiable `416` headers. Open the stream URL in VLC's "Open Network Stream" to confirm real seeking.
6. **Playback authorization**: integration-test loopback-only `POST` local play (mocking the launcher) and a LAN-address `403`; manually confirm local default-player launch and Explorer selection on Windows.
7. **LAN/Android playback**: from a second PC, confirm the `.m3u` contains the correct absolute stream URL and opens in a registered player. On Android with VLC/MX Player, confirm the chooser and seeking; without a compatible app, confirm the in-browser fallback.
8. **Settings and scheduling**: verify masked API keys preserve the saved secret on unrelated updates; add/remove folders and extensions and confirm subsequent scans respect them. Validate invalid cron expressions are rejected and a valid enabled schedule creates one scan run without overlap.
9. **Production build**: build the Vite client, start the Fastify production server, and confirm SPA fallback, API routes, media routes, and the LAN server-info display work from the same origin.
