# OttLib — Independent Product and Engineering Audit

- **Audited revision:** `19c465d` ("Keep HLS sessions alive and stop trusting an early ended on the web player (#24)"), branch `claude/elated-easley-bd70bf`, 2026-10-25.
- **Method:** read-only code review of every package (server, web client, shared, Android core/TV/mobile, CI/release), plus runtime checks against isolated scratch instances with synthetic media: server test suites, HTTP probes, a browser walk-through of the web app, Android unit tests/builds, and emulator launches.
- **Not used:** no existing plan, audit or review document was used as the basis of a finding. No application code or config was changed. The only file this audit adds is this report.

Evidence labels used throughout:

- **[runtime]** — observed while running the code (command, status code, log or UI state).
- **[code]** — read in source, with file:line.
- **[traced]** — logic followed by hand, or a small pure function executed in isolation.
- **[inferred]** — follows from library, OS or browser behaviour that was not run here.

Paths are relative to the repository root.

---

## A. Executive Summary

OttLib is substantially more mature than a typical hobby media server. It has a disciplined layered server, a real HLS remux/transcode pipeline with hardware-encoder detection and libplacebo tone-mapping, strict contract fixtures shared with Kotlin, three genuinely separate clients (web, Android TV, Android phone/foldable), and a signed release pipeline. Coding conventions in `AGENTS.md` are mostly followed. Only one product file exceeds 400 lines, and all 388 server, 144 client, 11 shared and 121 Android unit tests ran (two server tests are load-flaky, see AUD-025).

The weaknesses cluster in four places.

1. **The trust model is inconsistent.** It is documented as "trusted LAN unless you set a PIN", but a single static route serves the whole SQLite database, including plaintext provider passwords, PIN hashes and the stream-signing secret, to anyone who can call the API (AUD-001). There is no distinction between a household member and the owner for destructive operations (AUD-003, AUD-004).
2. **Profiles were added to the server and web client but not to Android.** As soon as a household creates a second profile or puts a PIN on the default profile, both Android apps receive `409 PROFILE_REQUIRED` on the library and playback routes and stop working (AUD-002). The contract fixtures were generated in a single-profile setup, so CI did not catch it.
3. **Library identity is path-based and TV support depends on TMDb.**
   - Renaming or moving a file silently orphans progress, watched state, manual matches and shelf membership (AUD-006).
   - Without a TMDb key, episodes are not recognised at all. Unmatched episodes of the same show are then classified as "duplicates" of each other, and the Compare flow can delete a real episode from disk (AUD-005, AUD-010).
4. **Playback correctness has several narrow but real holes.**
   - Any filename containing a character above U+00FF (Hindi, Tamil, CJK, Cyrillic, emoji) returns HTTP 500 on direct streaming (AUD-007).
   - Capability negotiation can choose stream-copy for codecs the target container or MSE cannot carry (AUD-011).
   - The Android TV app keeps playing after the user presses Home (AUD-008).
   - The Android apps send no HLS keep-alive, so a paused transcode is reaped after about 45 s (AUD-009).

**Most valuable product opportunities:**

- A real TV-show model: show, then season, then episode, with offline SxxEyy parsing.
- File-identity tracking, so renames keep history.
- Profiles on Android.
- A simple owner/admin role.
- Playback-recovery UX on every client (buffering state, retry, clear failure reasons).

These matter more than feature additions such as recommendations, collections or casting.

**Readiness.**

- *Single-user household, on a trusted network, no profiles, with TMDb configured:* ready for daily use.
- *Multi-profile household with Android devices:* not ready until AUD-002 is fixed.
- *Any network the owner does not fully trust (shared flat, dorm, guest Wi-Fi):* not ready until AUD-001, AUD-003 and AUD-004 are addressed.

No numeric score is given; the findings and their priorities are the assessment.

---

## B. Verified Application Inventory

Status legend: **Implemented**, **Partial** (works with material gaps), **Not implemented**, **Unable to verify** (not exercisable here).

### Server

| Capability | Status | Evidence |
|---|---|---|
| Folder scan, manual + cron schedule, no overlapping scans | Implemented | `services/scanService.ts:15-18`, `schedulerService.ts`; [runtime] scan of 8 files in ~1 s |
| Incremental change detection | Partial — single full walk; size+mtime per file | `repositories/movieRepository.ts:211-224` |
| Rename / move tracking | Not implemented | keyed on `canonical_path` UNIQUE (`movieRepository.ts:211-224`) |
| Scan cancellation, per-file progress detail | Not implemented | `routes/scan.ts` (start/status/history only) |
| Movie filename parsing (title + year) | Partial — misparses (AUD-012) | `services/scanner/titleParser.ts` |
| TV episode parsing from filenames | Not implemented offline; season/episode only come from TMDb match | `metadataMatchService.ts:27-30`; [runtime] S01E01/E02 → "Show Name", season/episode null |
| Show/season data model | Not implemented — each episode is a `movies` row; show key derived at query time | `movieRepository.ts:21-26` |
| TMDb metadata + artwork cache | Implemented | `providers/metadata/tmdbProvider.ts`, `services/posterCacheService.ts` |
| OMDb | Implemented as an *additional* candidate source, a real fallback only for refresh/backfill | `metadataMatchService.ts:56, 255-296` |
| Manual match (candidates, IMDb id, title override) | Implemented | `routes/library.ts:40-91` |
| Duplicate detection + compare/delete copy | Implemented (title/year or imdb match, no content check) | `movieRepository.ts:159-178`, `libraryDeletionService.ts` |
| Recommendations ("More like this") | Implemented | `services/recommendations/*` |
| Shelves (user collections) | Implemented (shared across profiles) | `shelfService.ts`, migration 005 |
| Franchise/collection grouping, favourites, watchlist | Not implemented | grep: no `belongs_to_collection`, `favorite`, `watchlist` |
| Byte-range streaming + HEAD | Implemented (no conditional requests) | `services/streamService.ts`; [runtime] |
| HLS remux / transcode, fMP4, keyframe-aligned remux | Implemented | `services/hls/*`; [runtime] |
| Hardware encode (NVENC, QSV, AMF) with probe + fallback | Implemented (no VAAPI / VideoToolbox) | `providers/transcode/encoderRegistry.ts`; [runtime] nvenc chosen |
| HDR → SDR tone-mapping (libplacebo, OpenCL, zscale) | Implemented | `providers/transcode/toneMapFilters.ts`; [runtime] libplacebo chain |
| Dolby Vision profile awareness | Not implemented | `mediaProbeService.ts:68-76` |
| Adaptive bitrate / quality selection | Not implemented (single rendition; `maxHeight` honoured server-side, but the web client never sends it) | `hlsPlaylist.ts`; `transcodeTarget.ts:5-9` |
| Embedded text subs → WebVTT; external sidecars; OpenSubtitles/SubDL download | Implemented | `embeddedSubtitleService.ts`, `providers/subtitles/*` |
| Image subtitles (PGS/VobSub) | Partial — burn-in only (forces transcode) | `playbackDecider.ts:12-13, 85` |
| Profiles, per-profile progress/watched, optional profile PIN | Implemented on server + web | migrations 019/020, `profileSessionService.ts` |
| Per-profile hidden titles | Server API implemented, **no client uses it** | `routes/hides.ts`; grep finds no `/api/hides` caller |
| Access PIN, login throttle, stream keys | Implemented | `services/accessPinService.ts`, `auth/loginThrottle.ts`; [runtime] 429 after 5 |
| Owner/admin authorization | Partial — only for profile management | `profileService.ts:86-88` |
| mDNS advertisement | Implemented | `services/discoveryService.ts` |
| Local playback on server PC (VLC / OS default), reveal in folder | Implemented (loopback only) | `routes/playback.ts:9-19`; [runtime] 403 from LAN |
| M3U playlist export | Implemented | `routes/stream.ts:19-25` |
| qBittorrent search/send plugin | Implemented (opt-in) | `providers/torrent/*` |
| Backup / restore, health dashboard, storage monitoring | Not implemented | — |
| Graceful shutdown | Partial — only when `advertise: true` | `index.ts:10-17` |

### Web client

| Capability | Status | Evidence |
|---|---|---|
| Home rows (continue watching, recently added, unwatched, shelves, genres) | Implemented | `hooks/useHomeRows.ts` |
| Library grid, filters, sort, debounced server search, URL state | Implemented (render-all, no virtualization) | `PosterGrid.tsx:31`, `LibraryFilters.tsx` |
| Title detail, duplicates compare, fix match, watched/unwatched, hide | Implemented | `pages/MovieDetailPage.tsx` |
| TV show / season / episode pages | Not implemented | routes in `App.tsx:47-62`; [runtime] |
| Next episode / Up Next countdown | Implemented | `UpNextOverlay.tsx`; [runtime] |
| Player: direct + hls.js / native HLS, audio & subtitle menus, shortcuts, resume chip | Implemented | `components/player/*`; [runtime] |
| Playback speed, PiP, quality selector, skip intro, buffering indicator, retry button | Not implemented | `useVideoState.ts:18`, `PlaybackProblem.tsx` |
| Profiles picker + PIN pad; access-PIN gate | Implemented | [runtime] |
| Settings (folders, keys, schedule, encoder, subtitles, qBittorrent, PIN, profiles) | Implemented | `pages/SettingsPage.tsx` |
| Dark / light / system theme | Implemented | `hooks/useTheme.tsx` |
| PWA install / offline | Partial — manifest without `start_url`, no service worker | `public/site.webmanifest` |

### Android

| Capability | Status | Evidence |
|---|---|---|
| mDNS discovery + manual address | Implemented (no multicast lock) | `core/discovery/ServerDiscovery.kt` |
| Access PIN sign-in | Implemented | `core/data/ConnectionManager.kt` |
| Profiles (select, PIN, `x-profile-session`) | **Not implemented** | grep: no `x-profile-session` in `apps/android` |
| TV: rows/grid, D-pad focus restore, remote seek, Watch Next, deep link | Implemented | `tv/ui/*`, `tv/watchnext/WatchNextPublisher.kt` |
| TV: pause on background | Not implemented | AUD-008 |
| Mobile: adaptive layouts, tabletop split, PiP, gestures, MediaSession (in-process) | Implemented | `mobile/ui/player/*` |
| Background playback / media notification service | Not implemented | no `MediaSessionService`, no foreground service |
| HLS keep-alive | Not implemented | AUD-009 |
| External player handoff | Implemented (no resume position passed) | `core/presentation/ExternalPlayer.kt:12-23` |
| Self-update from GitHub (SHA-256 + signature check, PackageInstaller) | Implemented | `core/update/*`; [runtime] update banner shown on emulator |
| Per-title track and picture-mode memory | Implemented | `TrackChoiceStore`, `PictureModeStore` |

---

## C. Architecture Assessment

### Shape

```
packages/shared   zod schemas + TS types (single source of truth for API shapes)
     │                    │
packages/server ──────────┼────────── packages/client (React SPA, served by the server)
  routes → services → repositories (SQLite, better-sqlite3, WAL)
               └→ providers (metadata, transcode, keyframes, subtitles, playback, torrent)
  hls/ : TranscodeSessionService → HlsSession → ffmpeg child (fMP4 on stdout → splitter → segment files in OS temp)
     │
contract/fixtures (written by nativeClient.test.ts) ──► apps/android core/model ContractFixturesTest
apps/android: core/{model,network,data,discovery,player,presentation,update} → tv, mobile
```

### Strengths

- **Clean, testable layering.** Services take their collaborators through constructors (`app.ts:103-123`). Providers sit behind interfaces: metadata, encoders, tone-map chains, playback handoff, subtitle providers. Adding an encoder or a subtitle provider is a one-file change, as `AGENTS.md` intends.
- **The HLS design is well considered.**
  - Segment boundaries come from Matroska cues for remux.
  - Transcodes use forced 4 s keyframes.
  - A VOD playlist is published up front, so seeking works immediately.
  - Far seeks restart ffmpeg at the right offset.
  - There are per-kind concurrency caps, idle reaping, per-device session replacement, and a back-pressure cap of 150 segments ahead.
  - Spawn uses argument arrays: no shell, so no injection [runtime: hostile filenames transcoded safely].
- **Auth primitives are done correctly.** PINs use scrypt with salts. Session tokens are 32 random bytes stored only as SHA-256. Comparisons are timing-safe. The throttle is per IP and ignores `X-Forwarded-For` [runtime].
- **The contract-fixture loop** (server → JSON → strict Kotlin decode) is a pragmatic answer to "Kotlin can't import zod", and it catches shape drift on every PR.
- **Android is modular.** UI-neutral logic sits in `core/presentation`, so the TV and phone apps share ViewModels and differ only in screens.

### Limitations and failure points

1. **Identity is the file path** (`movies.canonical_path`). Every user-owned fact hangs off `movies.id`: progress, watched state, hides (`m:<id>`), shelves, title overrides and manual matches. Every path change therefore loses user data (AUD-006). This is the most consequential schema decision in the project.
2. **No show/season entities.** TV is "movies with season/episode columns", and show metadata is copied onto every episode. Show pages, missing-episode reports, per-show artwork and specials all have nowhere to live (AUD-010).
3. **Authorization is a single bit** (access PIN on/off) plus profile scoping for *personal* data. Server-wide mutations have no owner gate: settings, folders, scan, file deletion, first PIN set (AUD-003).
4. **The static `/media/` mount is rooted at the data directory**, which also holds the database (`app.ts:125`, `db/db.ts:27`). Mixing public assets and private state in one directory is the root cause of AUD-001.
5. **The capability model describes progressive playback, but the server also uses it to choose HLS/fMP4 stream-copy** (AUD-011). The decider has no notion of "playable in container X via MSE".
6. **Error semantics.** The global handler turns every non-profile error into HTTP 400 with the raw message (`app.ts:133`), so clients cannot tell their own mistakes from server faults (AUD-026).
7. **Migrations are idempotent "ensure" functions with no version table.** Only `020` is transactional (`db/db.ts:31-50`). This is acceptable at the current size but brittle as the schema grows.
8. **The contract is versioned (`apiVersion = 1`), but behavioural changes are not versioned.** Profiles changed what a request without `x-profile-session` returns (data → 409) without bumping the version or adding a fixture. AUD-002 is the result.

### Proportionality

The architecture is appropriately sized for a LAN media server. Nothing here needs a message queue, a separate transcoder service or an ORM. The recommended changes are schema and authorization changes inside the existing layers.

---

## D. Detailed Findings

### AUD-001 — The `/media/` static route serves the entire database, including plaintext secrets

- **Category:** Security
- **Priority:** P0
- **Affected platform:** Backend (all clients)
- **Classification:** Security vulnerability (confirmed)
- **Confidence:** High

**Current behavior.** `@fastify/static` is mounted at `/media/` with `root` set to the application data directory (`packages/server/src/app.ts:125`). The SQLite database lives in that same directory as `library.sqlite`, with WAL files `library.sqlite-wal` and `-shm` beside it (`packages/server/src/db/db.ts:27-29`). The auth guard only requires a session for `/media/*` when an access PIN exists (`routes/authGuard.ts:22-32`).

**Evidence [runtime].** The probes were run against the isolated instance.

- **With no PIN** (the default), these all returned `200`, and the main file starts `SQLite format 3`:
  - `GET /media/library.sqlite` (4 KB header page)
  - `GET /media/library.sqlite-wal` (1.13 MB)
  - `GET /media/library.sqlite-shm`
- **The downloaded pair opened cleanly.** All 18 tables were readable.
- **Path aliases also returned `200`:** `/media/./library.sqlite`, `/media//library.sqlite`, `LIBRARY.SQLITE` and `library.sqlite::$DATA`.
- **With a PIN set**, a request without a session got `401`, but any valid session (cookie or Bearer) got `200`.
- **Secrets readable from the copy** (column names only; values were withheld):
  - `settings.value_json` holds the qBittorrent username and password, the OpenSubtitles password, the SubDL key, and the TMDb/OMDb keys in plaintext. Elsewhere these are masked by `services/settingsService.ts:7-14`.
  - `access_pin.pin_hash` and `access_pin.stream_secret`.
  - `profiles.pin_hash` for every profile.
- **Offline cracking.** The auditor's 4-digit access PIN was recovered in 32 s, single-threaded (about 24 ms per scrypt hash). 6 digits would take about 6.6 h.
- **Traversal out of the data directory was blocked.** Every `..` variant returned 400 or 404.

**Problem.** Private state is co-located with public artwork, so the static mount exposes it. This defeats every other protection:

- Settings masking is bypassed.
- Profile PINs can be cracked offline, which breaks profile privacy.
- `stream_secret` lets anyone forge `?key=` for every title, even after they are signed out.
- All profiles' watch history is readable.

**User impact.**

- *No PIN set (default):* anyone on the network gets every stored credential. That includes the qBittorrent WebUI password, which often equals other passwords.
- *PIN set:* any device or person who ever had the PIN gets permanent stream access, plus every other profile's PIN.

**Recommendation.** Move user-facing images into a dedicated subdirectory and mount only that.

1. Keep posters and backdrops under `<data>/posters`, `<data>/backdrops` and `<data>/subtitles` as today, and register static roots for those directories only. An alternative is a single `<data>/public`.
2. Keep `library.sqlite*` outside any served root.
3. As defence in depth, set `serveDotFiles: false` and an allow-list of extensions (jpg, png, webp, vtt, srt).
4. After the fix, rotate `stream_secret` on startup if the old layout is detected, so leaked keys stop working.
5. Note in release notes that users who ran without a PIN should change their qBittorrent and OpenSubtitles passwords.

**Implementation scope:** `app.ts` static registration; `posterCacheService.ts` and `subtitleLibraryService.ts` paths (unchanged if they already write under subfolders); URLs returned in `posterUrl` keep the `/media/posters/…` shape, so there is no contract change.

**Complexity:** Low.

**Verification:**
- Add a route test asserting that `GET /media/library.sqlite`, `-wal` and `-shm` return 404 with and without a session.
- Re-run the alias probes listed above.
- Check that the poster URLs in `contract/fixtures` still resolve.

---

### AUD-002 — Android TV and mobile break as soon as profiles are used

- **Category:** Cross-platform contract
- **Priority:** P0
- **Affected platform:** Android TV, Android phone/foldable
- **Classification:** Confirmed defect
- **Confidence:** High

**Current behavior.** The server resolves the acting profile from the `x-profile-session` header (`routes/profileContext.ts:16-28`). Without that header, `requireProfile` falls back to the sole profile only when **exactly one profile exists and it has no PIN**. Otherwise it throws `409 PROFILE_REQUIRED` (`services/profileSessionService.ts:43-51`).

`requireProfile` is called by:
- `GET /api/movies` (`routes/library.ts:24`)
- movie detail and duplicates (`library.ts:38, 59`)
- `GET /api/movies/:id/playback` (`routes/playback.ts:21`)
- continue-watching and progress (`routes/playbackProgress.ts`)
- hides

**Evidence.**
- [code] `apps/android` contains no `x-profile-session`, no profile model and no profile picker (grep over all `.kt` sources). `core/network` adds only `x-device-id` and `Authorization` (`DeviceIdInterceptor.kt:9`, `AuthTokenInterceptor.kt:14-15`).
- [runtime] On a server with two profiles, a request carrying no `x-profile-session`, or a forged one, got `409 {"error":"PROFILE_REQUIRED"}`.
- [code] The fixture generator `routes/nativeClient.test.ts` builds a single PIN-less profile, so `ContractFixturesTest` never sees the 409. `apiVersion` was not bumped when profiles shipped (`packages/shared/src/playback.ts:4`; profiles landed in `221528a`).

**Problem.** A shipped, user-facing server feature changes the meaning of existing endpoints for clients that don't know about it. The Android apps then show "Pick a profile to continue." (the server message) with no way to pick one.

**User impact.** A household that creates a "Kids" profile in the web UI loses both TV and phone apps entirely. Setting a PIN on the default "Home" profile has the same effect.

**Recommendation.**
1. **Short term (server):** treat profile-unaware clients explicitly. Two options:
   - Keep the "sole PIN-less profile" fallback, and also fall back to the *owner* profile for requests without the header while the owner has no PIN.
   - Report `profilesRequired: true` in `/api/server-info` and have the Android connect flow block with a clear "update the app" message instead of failing on every screen.
2. **Proper fix (Android):** add a profile picker and PIN pad to `core/presentation` (one ViewModel shared by TV and mobile). Store the profile session token per server next to the auth token, and send `x-profile-session` from an interceptor.
3. **Process:** bump `apiVersion` (or add a capability flag) for any change that alters behaviour for existing clients. Add multi-profile fixtures: a 409 body, and a profile list with `hasPin`.

**Implementation scope:** server `profileSessionService`, `serverInfoService`; shared `profiles.ts` and `serverInfo` schema; Android `core/model` (profile DTOs), `core/network` (interceptor + endpoints), `core/data` (token store), `core/presentation` (ProfilesViewModel), TV and mobile screens; contract fixtures.

**Complexity:** Medium (the Android picker); Low (the server-side stopgap).

**Verification:**
- Add `nativeClient.test.ts` cases with two profiles, one with a PIN, and generate fixtures for `GET /api/profiles`, `POST /api/profiles/:id/select` and the 409 body.
- Have the Kotlin `ContractFixturesTest` decode them.
- Manually: create a second profile on the web, then open the library and play a title on TV and phone.

---

### AUD-003 — No authorization tier: any client can run owner-level, server-wide operations

- **Category:** Security / Architecture
- **Priority:** P1
- **Affected platform:** Backend
- **Classification:** Security vulnerability (confirmed)
- **Confidence:** High

**Current behavior.** Only profile management checks the owner role (`services/profileService.ts:86-88`). Every other mutation needs only network reach (no PIN) or any access session (PIN set):

| Operation | Route | Evidence |
|---|---|---|
| Change settings (including qBittorrent URL, encoder, schedule) | `PUT /api/settings` (`routes/settings.ts:7`) | [code] |
| Add any existing directory as a library root | `POST /api/folders` (`routes/folders.ts:8`) | [runtime] `C:\Windows\System32\drivers\etc` returned `201`; a relative `..\..\..\..` resolved against the server cwd returned `201` |
| Delete a media file from disk | `DELETE /api/movies/:id/file` (`routes/library.ts:61-64`) | [code] no `requireProfile`, no owner check |
| Start scans, metadata refresh, auto-accept backfill | `routes/scan.ts:6`, `library.ts:27-36` | [code] |
| Set the access PIN when none exists (first caller wins) | `PUT /api/auth/pin` (`routes/auth.ts:13-16`, `accessPinService.ts:43-49`) | [runtime] |
| Open a folder-picker dialog on the server desktop | `POST /api/folders/select` (`services/folderPickerService.ts:13-21`) | [code] |

In addition, the default owner profile "Home" has no PIN (`db/migrations/019_profiles.ts:43-48`). Any client can select it and then create profiles, delete profiles, or set other profiles' PINs.

**Problem.** Profiles exist to separate household members, but a child's profile, or a guest device that was given the access PIN, can delete files, re-point the library at system folders, or lock the owner out by setting the access PIN first. The UI copy itself says profile PINs "don't secure the library" (`ProfilesSettingsSection.tsx:47`), but nothing secures it short of the all-or-nothing access PIN.

**User impact:**
- Accidental or malicious deletion of files.
- Exposure of non-media directories through scanning. Only allow-listed video extensions are indexed, but any such file anywhere becomes streamable.
- PIN takeover on a fresh install.

**Recommendation.** Introduce one *owner-only* gate, reusing the existing `isOwner` flag:
1. Add a `requireOwner(request)` helper beside `requireProfile`.
2. Apply it to settings writes, folders, scan and refresh triggers, file deletion, PIN set/remove, and profile admin.
3. Prompt for an owner PIN on first run (the web onboarding already has a checklist), and refuse owner operations while the owner profile has no PIN *and* the request is non-loopback.
4. For `PUT /api/auth/pin` when no PIN exists, accept only loopback requests or an owner-profile session.
5. Optionally restrict library roots to directories chosen via the loopback-only picker, or warn on system paths.

**Implementation scope:** `routes/*` (one helper call per route), `profileSessionService`, web Settings (hide or disable owner-only controls for non-owners via `utils/profileRights.ts`, which already exists), Android (read-only settings are unaffected).

**Complexity:** Medium.

**Verification:**
- Route tests: a non-owner session gets `403` on each listed route, and the owner gets `200`.
- A runtime check that a fresh install refuses `PUT /api/auth/pin` from a LAN IP.

---

### AUD-004 — The stored qBittorrent password can be sent to an attacker-chosen host (plus an SSRF oracle)

- **Category:** Security
- **Priority:** P1
- **Affected platform:** Backend (qBittorrent plugin users)
- **Classification:** Security vulnerability
- **Confidence:** High (code path); not exercised at runtime

**Current behavior.**
1. `PUT /api/settings` accepts a new `qbittorrentUrl` and `torrentSearchEnabled`, and silently keeps the stored password when the masked value is echoed back (`services/settingsService.ts:15-24`).
2. `POST /api/torrents/connection/test` (`routes/torrents.ts:17`) calls `QbittorrentClient.login`.
3. `login` POSTs `username` and `password` to `${baseUrl}/api/v2/auth/login` (`providers/torrent/qbittorrentClient.ts:64-68`).
4. Error bodies from that host are returned to the caller (`qbittorrentClient.ts:100-103` → `torrentConnectionService.ts:24-27`).

Separately, `GET /api/settings` masks secrets as `••••` plus the **last 4 characters**, including for the qBittorrent password [traced: `settingsService.get()` returned `••••ss17` for a 17-character password]. That leaks part of a password to every client.

**Problem.** A client that can call the API (see AUD-003) never needs to see the password. It can redirect it: set the URL to `http://attacker:8080`, then trigger the test. The same flow makes the server issue requests to arbitrary hosts and ports and report what came back (an internal-network probe).

**User impact.** Credential theft from anyone on the LAN (no PIN) or any PIN holder. It requires that the owner configured the qBittorrent plugin.

**Recommendation.**
- Clear the stored qBittorrent password (and require it to be re-entered) whenever `qbittorrentUrl` changes. Apply the same rule to subtitle-provider credentials if their endpoints ever become configurable.
- Make settings writes owner-only (AUD-003).
- Mask secrets fully (`••••`) rather than revealing the last 4 characters. For API keys, a "configured" boolean is enough.
- Return a generic error instead of the remote body.

**Implementation scope:** `settingsService.ts`, `qbittorrentClient.ts`, `torrentConnectionService.ts`, web Settings form (show the "re-enter password" state).

**Complexity:** Low.

**Verification:** Unit test that changing the URL wipes the stored password. A route test that `GET /api/settings` contains no plaintext suffix of any secret.

---

### AUD-005 — Unmatched episodes of a show are "duplicates" of each other; Compare can delete a real episode

- **Category:** Data integrity
- **Priority:** P1
- **Affected platform:** Backend, Web, Android (Compare flow)
- **Classification:** Confirmed defect (traced; delete not executed)
- **Confidence:** High

**Current behavior.** Without TMDb, `Show.Name.S01E01.mkv` and `Show.Name.S01E02.mkv` both parse to title "Show Name" with no year [runtime], because the parser strips `SxxEyy` and records no season or episode (`titleParser.ts:25`, `config/defaults.ts:10`). With no `imdb_id`, `findDuplicateIds` matches on `LOWER(TRIM(title))` and `year IS NULL` (`repositories/movieRepository.ts:174-176`). Each episode therefore lists every other episode as an "other copy". `LibraryDeletionService.deleteCopy` refuses only when the duplicate list is empty (`libraryDeletionService.ts:17-19`) and then `unlink`s the file (line 22).

**Problem.** The safety rule "never delete the only copy" is computed from a heuristic that treats different episodes as the same title.

**User impact.** A user tidying "duplicates" in the Compare dialog can permanently delete episodes. The same applies to any two different files that parse to the same title with no year, such as a film and its "Part 2" when the year is missing.

**Recommendation.**
- Never consider rows with different parsed season/episode as duplicates. This requires AUD-010's offline SxxEyy parsing.
- Require a matching `imdb_id` (and season/episode), *or* matching title + year + runtime within about 2%, before offering deletion. Leave title-only matches as "possible duplicates" without a delete action.
- Add a confirmation that names both files and shows their durations.

**Implementation scope:** `movieRepository.findDuplicateIds`, `libraryDeletionService.ts`, `DuplicateCompareDialog.tsx` / `DeleteCopyDialog.tsx`, Android `CompareViewModel`.

**Complexity:** Low–Medium.

**Verification:** Repository tests: two unmatched episodes are not duplicates; an unmatched film with an identical sibling is. A route test that `DELETE /file` returns 409 for the episode case.

---

### AUD-006 — Renaming or moving a file silently discards its history, match and shelves

- **Category:** Data integrity
- **Priority:** P1
- **Affected platform:** Backend (visible on all clients)
- **Classification:** Confirmed defect (design)
- **Confidence:** High

**Current behavior.** Scanned files are keyed by `canonical_path` UNIQUE (`movieRepository.ts:211-224`). A renamed or moved file becomes a new row with no metadata, progress, watched state, title override, shelf membership, hides (`m:<id>`) or play history. The old row is set `missing = 1` (`movieRepository.ts:244-246`) and kept forever with its orphaned data.

A related path: deleting one copy via Compare calls `deleteMovie` (`libraryDeletionService.ts:28`). Migration 020's `ON DELETE CASCADE` then removes *all profiles'* progress and watched state for that row, even though the title survives as the other copy.

**Problem.** Reorganising a library is routine: moving films into per-title folders, renaming to a naming convention, or moving to a new drive. Each time, users lose resume points, watched flags and manual corrections, with no warning.

**User impact.** Continue Watching empties. Watched badges vanish. Hand-fixed matches revert to "Not matched". Missing ghost entries accumulate under "Unavailable".

**Recommendation.**
1. At scan time, before inserting a new row, look for a `missing` row with the same file size and either the same duration (from ffprobe, already collected) or the same filename, or the same first and last 64 KB hash (cheap to compute). If one is found, update its `canonical_path` instead of inserting.
2. On delete-copy, reassign progress and watched rows to the surviving duplicate before deleting.
3. Offer "Remove missing titles" with a count, rather than keeping orphans forever.

**Implementation scope:** `scanService.ts`, `movieRepository.upsertScanned`, a small `fileIdentity` helper, `libraryDeletionService.ts`.

**Complexity:** Medium.

**Verification:** A scanner test: scan, record progress, rename the file, rescan, and assert the same `movies.id`, progress intact and `missing = 0`. Repeat for a move across folders of the same root and across roots.

---

### AUD-007 — Direct streaming returns HTTP 500 for filenames containing any character above U+00FF

- **Category:** Streaming
- **Priority:** P1
- **Affected platform:** Backend (web direct play, Android direct play, VLC, M3U)
- **Classification:** Confirmed defect
- **Confidence:** High

**Current behavior.** `StreamService.open` puts the raw basename into `content-disposition: inline; filename="…"`, replacing only `"` and `\` (`services/streamService.ts:16`). Node rejects header values containing code points above U+00FF.

**Evidence.**
- [runtime] For `千と千尋 Тест 🎬 (2001).mp4`:
  - `GET /api/stream/6`, with or without `Range`, returned `500 {"code":"ERR_INVALID_CHAR","message":"Invalid character in header content [\"content-disposition\"]"}`.
  - `HEAD` returned the malformed status line `HTTP/1.1 400 OK`.
  - The log shows `FastifyError: Attempted to send payload of invalid type 'object'`.
- [runtime] `é` (U+00E9) passes but is sent as a raw Latin-1 byte.
- [traced] Node 24 `setHeader('content-disposition', 'inline; filename="千.mp4"')` throws `ERR_INVALID_CHAR`.

HLS does not use the filename, so transcoded playback of the same file works [runtime].

**Problem.** Any library with Hindi, Tamil, Telugu, CJK, Cyrillic, Arabic or emoji filenames cannot direct-play those titles.

**User impact.** Those titles fail on every client's default path, with a misleading error. This is especially relevant given the stated Bollywood focus.

**Recommendation.** Emit `filename="<ASCII fallback>"; filename*=UTF-8''<percent-encoded>` per RFC 6266/5987. Alternatively, drop `content-disposition` for `inline` streams entirely; players don't need it. Apply the same to the M3U download header.

**Implementation scope:** `streamService.ts` (one function), plus a test in `streamService.test.ts`.

**Complexity:** Low.

**Verification:** A unit test with CJK, Devanagari and emoji names asserting status 200/206 and a valid header. Re-run the HEAD probe.

---

### AUD-008 — Android TV keeps playing after the user presses Home or the TV sleeps

- **Category:** Android TV
- **Priority:** P1
- **Affected platform:** Android TV
- **Classification:** Confirmed defect (code); behaviour not run on a TV device
- **Confidence:** High (code), Medium (exact OS behaviour)

**Current behavior.** The mobile player pauses on `ON_STOP` (`mobile/.../ui/player/PlayerScreen.kt:71`). The TV player's only `ON_STOP` handler cancels auto-play on the "ended" screen (`tv/.../ui/player/PlayerScreen.kt:50`). The ExoPlayer lives in `PlayerViewModel`, which survives the activity going to the background. The only programmatic pauses are for problems and fallbacks (`core/presentation/.../PlayerViewModel.kt:128, 247`). The TV app has no `MediaSession` (mobile has one in-process only, via `MediaSessionEffect.kt`).

**Problem.** Pressing Home, switching input, or an Ambient/screensaver transition stops the activity, but audio continues with no on-screen or system media controls. The server keeps streaming and progress keeps advancing.

**User impact.**
- Audio plays from a "closed" app.
- Watch progress jumps ahead, so the resume point is wrong.
- Bandwidth and transcode slots are wasted until the process is killed.

**Recommendation.** Mirror the mobile `LifecycleEventEffect(ON_STOP) { player.pause() }` in the TV `PlayerSurface`, then save progress (the ProgressReporter already saves on pause). Consider adding a `MediaSession` on TV so the system and Google Assistant can pause and resume.

**Implementation scope:** `tv/ui/player/PlayerScreen.kt` or `PlayerSurface.kt`.

**Complexity:** Low.

**Verification:** On a TV device or Android TV emulator: start playback, press Home, and confirm audio stops and the saved position is close to the moment Home was pressed. Add a Robolectric/Compose test if TV UI tests are introduced (AUD-025).

---

### AUD-009 — Android sends no HLS keep-alive; a paused remux/transcode session is reaped after ~45 s

- **Category:** Streaming / Android
- **Priority:** P1
- **Affected platform:** Android TV, Android phone (server-converted playback)
- **Classification:** Confirmed defect (code); end-to-end on device not verified
- **Confidence:** Medium-High

**Current behavior.** Sessions idle for 45 s are swept every 10 s (`server config/transcode.ts:49-50`, `transcodeSessionService.ts:149-153`). The web client pings `POST …/keepalive` every 15 s (`client utils/sessionKeepAlive.ts:2`). The Android apps have no keep-alive: grep for `keepalive` in `apps/android` returns nothing. Media3's LoadControl buffers up to 90 s ahead (`core/player/OttlibPlayerFactory.kt:33-36`), and while paused it stops requesting once the buffer is full. On failure, `retry()` re-prepares the same, now-deleted playlist (`PlayerViewModel.kt:232-235`).

[runtime] Server-side reaping was observed: session directories disappeared 35–60 s after the last request.

**Problem.** "Play via server" is offered when the device can't decode the audio or video. That stream dies on any pause longer than about 45 s plus the remaining buffer, and Retry cannot recover it.

**User impact.** "Pause to grab a drink" breaks playback of exactly the files that needed the server's help, typically DTS/TrueHD audio on TVs. The user must back out and start "Play via server" again.

**Recommendation.**
1. Add a coroutine in `PlayerViewModel` that POSTs `sessionUrl + /keepalive` every 15 s while an HLS source is active, including while paused.
2. On `HttpDataSource` 404 for a session URL, re-request `/playback` with the same capability set and `startMs = currentPosition` (transparent session reopen), as the web player does (`WatchPage.tsx:92-99`).
3. Make the idle timeout a shared constant exposed via `server-info`, so clients don't hard-code 15 s against 45 s.

**Implementation scope:** `core/network` (keepalive endpoint), `core/presentation/PlayerViewModel.kt`, shared `serverInfo` (optional).

**Complexity:** Low–Medium.

**Verification:** Device test: start a forced transcode, pause for 3 minutes, resume, and expect continuous playback. Unit test: the ViewModel issues keep-alives while paused, and reopen-on-404 restores the position.

---

### AUD-010 — TV shows are not identified without TMDb, and there is no show/season model or UI

- **Category:** Library / Product
- **Priority:** P1
- **Affected platform:** Backend, Web, Android
- **Classification:** Missing feature / Confirmed defect
- **Confidence:** High

**Current behavior.**
- [runtime] With no TMDb key, `Show.Name.S01E01.mkv` and `S01E02.mkv` become two identical "Show Name" tiles with `season`, `episode` and `showKey` all null. The "TV" type filter returns 0.
- [code] Season and episode exist only after a TMDb/OMDb match (`metadataMatchService.ts:27-30`).
- [code] There is no show or season table. Show metadata is copied onto every episode row (`metadataMatchService.ts:308-320`), and every episode stores its own copy of the show backdrop (`posterCacheService` key includes `s#e#`).
- [code] The library lists one tile per file (`movieRepository.listSummaries`, no grouping).
- [code] The web app has no show or season page. The router has only `/movie/:id` (`client/src/App.tsx:47-62`). Navigation between episodes is "Play next" only.
- [traced] Parser edge cases:
  - `Season 1/S01E02.mkv` gets the title `S01E02` (the folder fallback never runs).
  - `01 - Pilot.mkv` gets the title `Pilot`.
  - `S01E01E02` yields a single episode.
- [code] Specials (S00) cannot be matched: season 0 is rejected as falsy (`metadataMatchService.ts:206, 235`) and excluded from next-episode logic (`movieRepository.ts:126`).

**Problem.** TV is a headline capability, but it depends entirely on an online provider and a fragile title search. The browsing model also doesn't scale to shows with hundreds of episodes.

**User impact.**
- Libraries with TV appear as dozens of duplicate-looking tiles.
- There is no way to see a season list, which episodes are watched, or what's missing.
- Specials and multi-episode files are invisible to episode logic.

**Recommendation.**
1. Parse `SxxEyy`, `NxNN`, `Season N/Episode N`, multi-episode `E01E02` / `E01-E02`, `S00` and air-date patterns at scan time into `parsed_season` and `parsed_episode`. Derive the show title from the filename prefix or the parent "Show/Season N" folders.
2. Introduce `shows` (and optionally `seasons`) tables keyed by the provider show id, or by normalised title when unmatched. Episodes reference `show_id`, and show artwork and overview live on the show.
3. Group episodes into one show tile in library queries. Add a show page (seasons as tabs, episodes with watched and progress state) on web, TV and mobile.
4. Match the show once and then fetch episode metadata by season and episode, instead of searching per file.

**Implementation scope:** a migration, `titleParser`, `scanService`, `metadataMatchService`, `movieRepository` (or new `showRepository`), shared schemas, a web route and page, Android `DetailsViewModel` + screens, fixtures.

**Complexity:** High.

**Verification:**
- A parser table test with the patterns above.
- A scan test that two unmatched episodes group under one show with seasons and episodes set.
- UI: the show page lists S1E1 and S1E2 offline.

---

### AUD-011 — Capability negotiation can choose stream-copy for audio the HLS/fMP4 path can't carry

- **Category:** Streaming
- **Priority:** P1
- **Affected platform:** Backend, Web (and any HLS client)
- **Classification:** Confirmed defect in the tested environment; Needs verification on the bundled ffmpeg and other browsers
- **Confidence:** Medium-High

**Current behavior.** The browser builds one capability list from `canPlayType` (`client/src/utils/browserCaps.ts:25-45`). `mp3` is reported when `canPlayType('audio/mpeg')` succeeds, which is a *progressive* answer. The server uses the same list to decide `audioCopy` for HLS fMP4 sessions (`server/src/services/playbackDecider.ts:66-89`, `hls/ffmpegCommand.ts:41-46`).

**Evidence [runtime].**
1. **MP3 copied into fMP4.**
   - The file was an AVI with MPEG-4 Part 2 video and MP3 audio.
   - The server answered `mode: transcode, reasons: [container, video-codec]` and copied the MP3 into fMP4.
   - In the embedded Chromium, `MediaSource.isTypeSupported('audio/mp4; codecs="mp4a.6b"')` is `false`.
   - The player showed "This browser couldn't play the video." after three `seg-0.m4s` fetches. The console showed a `querySelector` null error.
2. **AC-3 copied into fMP4.** An MKV with AC-3 audio, requested with caps listing ac3 (Android-like caps; Safari or Edge would send the same), was remuxed with `-c:a copy`. `init.mp4` and every segment then returned `500 "Cannot write moov atom before AC3 packets. Set the delay_moov flag"`. This was ffmpeg `2024-01-01`; the release bundle pins `autobuild-2026-10-23` (`scripts/bundle-ffmpeg.mjs:14`), which was not tested.
3. **ffmpeg missing.** [code] When ffmpeg is unavailable the decider returns `direct` even for MKV/AVI (`playbackDecider.ts:84`), and the browser then fails generically.

**Problem.** The decider answers "can this client decode codec X?" when the real question is "can this client decode codec X *inside the container I'm about to produce*, via MSE?"

**User impact.** Some files fail outright on the web player with a generic message, even though transcoding the audio to AAC would have worked.

**Recommendation.**
- Have the web client send a separate `hlsAudio` list probed with `MediaSource.isTypeSupported('audio/mp4; codecs=…')`, or have the server copy into fMP4 only AAC, AC-3/E-AC-3 and FLAC/Opus where verified.
- Add `+delay_moov` to `-movflags` when copying AC-3/E-AC-3, or always re-encode AC-3 to AAC for fMP4.
- When ffmpeg is missing and the decision isn't `direct`, return an explicit `unsupported` reason so clients can say "install ffmpeg on the server".

**Implementation scope:** `browserCaps.ts`, shared `playbackRequest` schema (new optional field), `playbackDecider.ts`, `ffmpegCommand.ts`, client `PlaybackProblem.tsx`.

**Complexity:** Low–Medium.

**Verification:**
- Extend `hlsRealFfmpeg.test.ts` with AC-3 and MP3 copy cases, using the bundled ffmpeg version.
- Add decider unit tests for "mp3 progressive yes, MSE no".
- Run a browser check in desktop Chrome, Firefox and Safari.

---

### AUD-012 — Filename parser produces wrong titles and years for common names

- **Category:** Library
- **Priority:** P2
- **Affected platform:** Backend
- **Classification:** Confirmed defect
- **Confidence:** High

**Current behavior.** `parseReleaseName` (`services/scanner/titleParser.ts:18-27`) takes the *first* 1888–2099 token as the year, drops a year more than one year in the future, and strips genre words and release tags anywhere in the title.

**Evidence [traced].** `parseTitle` was executed on these inputs:

| File | Parsed |
|---|---|
| `Blade Runner 2049 (2017).mkv` | title `Blade Runner`, year `null` |
| `2001 A Space Odyssey (1968).mkv` | title `2001 A Space Odyssey (1968)`, year `2001` |
| `1917 (2019).mkv` | title `1917 (2019)`, year `1917` |
| `Action Jackson (1988).mkv` | title `Jackson` |
| `The Family Man (2000).mkv` | title `The Man` |
| `Sci-Fi Thing (2010).mkv` | `Sci Fi Thing` (the `sci-?fi` genre pattern never matches after normalisation) |

**Problem.** A wrong title or year produces a wrong match. TMDb is searched *with* the year as a filter and never retried without it (`tmdbProvider.ts:15-16`). Exact title plus year auto-accepts at a score above 0.75, so a wrong year can mean either no match or a confidently wrong one.

**User impact.** Mislabelled titles, missing artwork, and extra time spent in "Fix match".

**Recommendation.**
- Prefer a year in brackets or parentheses, or the *last* plausible year token followed by release noise, over the first one.
- Never strip genre words. They are rarely release noise, and releases don't contain them.
- If the title becomes empty, keep the numeric token as the title (2001, 1917, 2012).
- Retry TMDb without the year when the year-filtered search returns nothing.

**Implementation scope:** `titleParser.ts`, `config/defaults.ts`, `tmdbProvider.ts`.

**Complexity:** Low.

**Verification:** Extend `titleParser.test.ts` with the table above plus about 30 real-world release names. The test belongs in CI because it is pure.

---

### AUD-013 — Manual metadata decisions can be silently overwritten

- **Category:** Metadata
- **Priority:** P2
- **Affected platform:** Backend
- **Classification:** Confirmed defect (code)
- **Confidence:** High

**Current behavior.**
1. **File changes undo manual matches.** When a file's size or mtime changes, for example after re-muxing to add a subtitle or a tag edit, `resetForRematch` clears the provider, metadata, season and episode (`movieRepository.ts:223, 319-325`). The scan then re-suggests with auto-accept (`scanService.ts:31`). A manually chosen match is replaced if the new top candidate scores above 0.75. The title override survives.
2. **Refresh undoes dismissals.** `listMetadataRefreshTargets` filters only `missing = 0` (`movieRepository.ts:196`), so "Refresh all" resets and auto-accepts titles the user had explicitly dismissed (`metadataMatchService.ts:142-144`, `movieRepository.ts:254-256`).
3. **OMDb lowers the auto-accept bar.** OMDb exact-title hits score 0.85 with no year check (`omdbProvider.ts:17`), so they auto-accept above the 0.75 threshold even when the filename year disagrees. Adding an OMDb key therefore makes auto-matching *less* careful than TMDb alone, where exact title without year scores 0.75 and is not accepted.

**User impact.** Hand-fixed titles revert. Remakes get swapped. "Not this one" choices come back.

**Recommendation.**
- Add `match_locked` (set by accept, manual, from-imdb and dismiss). Scans and refreshes then keep the provider id and only refresh fields.
- Include OMDb's year in its score, and cap OMDb scores at TMDb's no-year level.

**Implementation scope:** a migration, `movieRepository`, `metadataMatchService`, `omdbProvider`.

**Complexity:** Low–Medium.

**Verification:** Service tests: accept a candidate, change the mtime, rescan, and assert the same provider id. Dismiss, run refresh-all, and assert it is still dismissed.

---

### AUD-014 — Avoidable re-encodes and missed direct play

- **Category:** Streaming / Performance
- **Priority:** P2
- **Affected platform:** Backend (all clients)
- **Classification:** Performance issue / Confirmed defect
- **Confidence:** High (code)

**Current behavior.**
1. **Non-Matroska sources can never be remuxed.** Remux needs a keyframe index, and only Matroska cues are read (`providers/keyframes/keyframeRegistry.ts:5`, `matroskaCues.ts:155`). An MP4, MOV, AVI or TS with H.264 video whose *audio* needs conversion is therefore fully re-encoded (`playbackDecider.ts:87`, reason `no-keyframes`). [runtime] Even an MKV with a single keyframe was transcoded for the same reason, which is correct for that file.
2. **Default audio track position.** `chooseAudio` falls back to the default-flagged track, and any chosen track other than `audio[0]` adds reason `audio-track` (`playbackDecider.ts:55-57, 76`). A file whose default-flagged track is not first is never direct-played, even when the client asked for nothing.
3. **Codec profile and bit depth ignored.** Only the codec name is compared (`playbackDecider.ts:71`), although `videoProfile` is probed and stored (`mediaProbeService.ts:104`). H.264 High 10 or 4:2:2 is sent direct to browsers that cannot decode it.
4. **MKV never direct-plays on the web**, which is correct: browser MKV support is unreliable. [runtime] Android-like caps that *include* `mkv` still got `remux [container]` for an MKV with HDR, so Android's ExoPlayer, which plays MKV natively, is never offered direct MKV through this endpoint. Normally Android plays the direct URL itself and asks the server only on failure (`ServerFallbackCaps.kt`), so the impact is small. The decider's container table (`playbackDecider.ts:11`) simply has no `mkv` entry.

**User impact.** Unnecessary CPU/GPU load and quality loss on remuxable files. The 3-transcode cap is hit sooner. Some 10-bit H.264 files fail in browsers instead of being transcoded.

**Recommendation.**
- Add an MP4 `stss`/`moof` keyframe reader, which is cheap and the same shape as `matroskaCues`, or use `ffprobe -skip_frame nokey` once and cache the result in `media_tracks`.
- Pass `audio-track` only when `request.audioOrder` was explicitly given.
- Add `videoProfile`/bit-depth vocabulary to the capability request (`h264-high10`, `hevc-main10`).
- Add `mkv` to direct containers for clients that list it.

**Implementation scope:** `providers/keyframes`, `playbackDecider.ts`, `browserCaps.ts`, shared `playbackRequest`.

**Complexity:** Medium.

**Verification:** Decider table tests for each case. Run a real-ffmpeg test on an MP4 with DTS and check that the session is `remux`.

---

### AUD-015 — Dolby Vision profiles are not distinguished; DV profile 5 can be sent unconverted

- **Category:** Streaming / HDR
- **Priority:** P2
- **Affected platform:** Web (HDR displays), external players
- **Classification:** Needs verification
- **Confidence:** Medium (mechanism high; visual result not observed)

**Current behavior.**
- [code] Any `dovi`/"dolby vision" side data becomes `hdrFormat: "Dolby Vision"`, but only `side_data_type` is kept (`mediaProbeService.ts:18, 68-76`), so the profile (5, 7, 8.1, 8.4) is unknown.
- [code] A client reporting `hdr=true` (browsers via `matchMedia('(dynamic-range: high)')`, `browserCaps.ts:93`) gets HDR files direct or as video-copy (`playbackDecider.ts:69`).
- [inferred] Profile 5 has no HDR10-compatible base layer. Players without DV decoding show it green or purple.
- [inferred] Tone-mapping only happens for clients that don't claim HDR.

**User impact.** Wrong colours on some DV releases (common for streaming-service rips) on HDR-capable browsers that cannot decode DV.

**Recommendation.** Parse `dv_profile` and `dv_bl_signal_compatibility_id` from ffprobe side data. Treat profile 5 as "needs tone-map" unless the client advertises `dolby-vision`. Treat 8.x as HDR10-compatible.

**Implementation scope:** `mediaProbeService.ts`, `playbackDecider.ts`, `browserCaps.ts`.

**Complexity:** Low–Medium.

**Verification:** Play a DV profile 5 sample on an HDR monitor in Chrome and Edge, and compare against the tone-mapped path.

---

### AUD-016 — Hidden titles are per device, not per profile; the server's per-profile API is unused

- **Category:** Profiles / Cross-platform
- **Priority:** P2
- **Affected platform:** Web, Android, Backend
- **Classification:** Confirmed defect (UX contradiction)
- **Confidence:** High

**Current behavior.**
- The server implements per-profile hides: `GET/POST/DELETE /api/hides` and `/api/hides/import` (`routes/hides.ts`), stored in table `movie_hides` (migration 019).
- The web client stores hides in `localStorage` (`client/src/hooks/useHiddenTitles.ts:5-6`). Android stores them in DataStore (`core/data/HiddenTitleStore.kt:15-17`).
- No client calls `/api/hides` (grep).
- Settings tells users "Each profile has its own watch progress, watched titles and hidden titles" (`ProfilesSettingsSection.tsx:47`). The hide toast and Hidden page say "on this device" [runtime].
- The play-history endpoint `POST /api/movies/:id/plays` is likewise unused by clients.

**User impact.** A parent hides a title for the "Kids" profile on the TV, and it still appears for that profile on the web and the phone, and for *every* profile on that TV. The feature does not protect what the settings copy implies.

**Recommendation.**
- Move both clients to `/api/hides` behind the existing hooks and stores.
- Run the provided `/api/hides/import` once to migrate local lists.
- Keep a device-local "hide on this device only" option only if users actually want it.
- Fix the copy in the meantime.

**Implementation scope:** `useHiddenTitles.ts`, `HiddenTitlesPage.tsx`, Android `HiddenTitleStore` + `HiddenTitlesViewModel`, fixtures for the hides endpoints.

**Complexity:** Low–Medium.

**Verification:** Hide on web under profile A. TV shows it hidden for A, and not hidden for profile B.

---

### AUD-017 — Android connection and error recovery is brittle

- **Category:** Reliability / UX
- **Priority:** P2
- **Affected platform:** Android TV, Android phone
- **Classification:** Reliability risk / UX problem
- **Confidence:** High (code), Medium (impact)

**Current behavior.**
- **No 401 handling.** Changing, removing or resetting the access PIN clears every session (`accessPinService.ts:43-47, 52-63`). The apps never react to 401 and only re-check auth on connect (`ConnectionManager.kt:41-44`), so screens show "Enter the access PIN to continue." until relaunch.
- **Raw exception text.** [runtime] Connecting to a bad address showed `Unable to resolve host "210.0.2.": No address associated with hostname`. Decode failures from a newer server are reported as "Could not reach host:port" (`ConnectionManager.kt:39, 52-54`).
- **Server IP changes.** Only the stored URL is used to reconnect (`ConnectViewModel.kt:41-43, 86`). Discovery results never update it, so a DHCP change means re-pairing.
- **Playback errors.** `retry()` re-prepares the same source (`PlayerViewModel.kt:232-235`), with no fresh `/playback` request and no automatic retry after Wi-Fi drops.
- **Discovery failures.** A failure to start discovery closes the flow silently (`ServerDiscovery.kt:29`). No `MulticastLock` is taken, which some TV boxes need for mDNS [inferred].

**User impact.** "It stopped working" moments after routine events (PIN change, router reboot, server restart) that the app could recover from by itself.

**Recommendation.**
- Handle 401 centrally (interceptor → re-auth screen).
- Map exceptions to friendly messages.
- When the saved server fails, look for a discovered server with the same `name` (TXT record) and update the URL.
- Make Retry re-request `/playback` at the current position.
- Acquire a `WifiManager.MulticastLock` during discovery and show "Discovery unavailable — enter the address".

**Implementation scope:** `core/network` (interceptor), `core/data/ConnectionManager.kt`, `core/presentation/ConnectViewModel.kt`, `PlayerViewModel.kt`, `core/discovery`.

**Complexity:** Medium.

**Verification:** Unit tests: ConnectViewModel with a fake API that returns 401 / a new address; PlayerViewModel retry calls `/playback`. Device test: change the server IP and confirm auto-reconnect.

---

### AUD-018 — Web player gives little feedback and no recovery path

- **Category:** UX / Playback
- **Priority:** P2
- **Affected platform:** Web
- **Classification:** UX problem
- **Confidence:** High

**Current behavior.**
- [code] No `waiting`/`stalled` handling (`components/player/useVideoState.ts:18`), so there is no buffering indicator after start.
- [code] `PlaybackProblem.tsx:4-11` has no Retry, and the same text covers every failure.
- [runtime] A corrupt file, an unsupported codec and an MP3-in-fMP4 failure all show "This browser couldn't play the video." "Open in VLC" is offered even for a deleted file.
- [runtime] There is no playback speed, PiP, quality cap or start-over once resumed (only a 5 s "Start over" chip).
- [runtime] Continue Watching cards show no progress bar or remaining time, and open the detail page rather than resuming.
- [runtime] The first Back click while the controls are hidden does nothing.

**User impact.** Users can't tell slow from broken. They can't recover without reloading, and they have to click twice to resume.

**Recommendation.**
- Add a buffering spinner on `waiting`.
- Add Retry (reopen the source at the current time).
- Map the server's `reasons` and HTTP status to specific messages.
- Add a progress bar to Continue Watching cards that resumes directly.
- Add `playbackRate` and the `requestPictureInPicture` button, both cheap.
- Hide "Open in VLC" when the source is missing.

**Implementation scope:** `components/player/*`, `PosterCard`/`HomeRowSection`.

**Complexity:** Low–Medium.

**Verification:** Component tests with a fake media element firing `waiting` / `error`; a manual check with network throttling.

---

### AUD-019 — Scans are fragile on real-world folders and slow when providers misbehave

- **Category:** Reliability
- **Priority:** P2
- **Affected platform:** Backend
- **Classification:** Reliability risk
- **Confidence:** High (code)

**Current behavior.**
- **One unreadable entry fails the whole folder.** `readdir` and `stat` in the walker have no per-entry error handling (`services/scanner/walker.ts:20, 27`). One `EPERM`, which is typical for `System Volume Information` or `$RECYCLE.BIN` when a drive root is added, aborts that root and marks the run `failed`. Missing-marking is correctly skipped, so no data is lost.
- **No cancellation** (`routes/scan.ts`).
- **Sequential, unthrottled provider calls.** Per new or errored file, providers are called in sequence with 15 s timeouts and no retry or back-off (`metadataMatchService.ts:56-61`, `tmdbProvider.ts:70`). A TMDb `429` is recorded as "no matching metadata" (`tmdbProvider.ts:16, 30`). Errored rows retry on *every* scan. With a provider outage, a large first scan takes hours.
- **Uncaught failures.** `void this.execute(...)` (`scanService.ts:17`) has statements outside its try block (`:22-23, 35, 37`), and there is no `unhandledRejection` handler, so a DB error there can crash the process [inferred].
- **Artwork failures.** An artwork network error throws through `applyMetadata` and fails the whole match (`posterCacheService.ts:18`; AUD-037).
- **Per-file directory re-read.** External-subtitle discovery re-reads the whole directory for every file (`externalSubtitleScanner.ts:25`), which is O(N²) in flat folders.

**User impact.** "Scan failed" with no clear cause. Very slow first scans. Metadata stuck as "error" after a rate-limit burst.

**Recommendation.**
- Make the walker skip unreadable entries and collect them as warnings (with defaults ignoring the Windows system folders).
- Add a cancel endpoint (an AbortController checked per file).
- Separate the walk (fast, local) from metadata enrichment (a background queue with concurrency of 2–4, honouring `Retry-After`, exponential back-off, and a circuit breaker per provider).
- Wrap `execute` in a top-level catch that finishes the run as `failed`.
- Cache the directory listing per directory during a scan.

**Implementation scope:** `walker.ts`, `scanService.ts`, `metadataMatchService.ts`, provider classes, `externalSubtitleScanner.ts`.

**Complexity:** Medium.

**Verification:** Scanner tests with an unreadable subfolder (mock fs). A provider test with a fake 429 → retry. A cancel test.

---

### AUD-020 — Library performance has no ceiling-aware paths (render-all, refetch-all, full-table queries)

- **Category:** Performance
- **Priority:** P2
- **Affected platform:** Web, Backend
- **Classification:** Performance issue
- **Confidence:** Medium (code-level; not benchmarked)

**Current behavior.**
- **Web rendering.** The grid renders every loaded item with no virtualization (`client/src/components/PosterGrid.tsx:31`). At 10,000 titles that is 10k `PosterCard`s with router hooks each.
- **Refetch during scans.** `useScanMovieRefresh` refetches the library every 15 s (`hooks/useScanMovieRefresh.ts:18-22`). For a TanStack infinite query that re-requests *every loaded page* (about 209 requests at 10k titles) [inferred from TanStack v5 semantics].
- **Server queries.**
  - Filter options parse genres and cast JSON for every matched row on each request (`movieRepository.ts:89-101`).
  - Recommendations load and score the whole matched pool on every detail view (`recommendationService.ts:15-29`, `movieRepository.ts:60-69`).
  - Duplicates, next-episode and torrent matching filter on `imdb_id`, `provider_id`, `season` and `metadata_status`, none of which are indexed (migrations 001/020).
  - Every library page runs `COUNT(*)` with a join (`movieRepository.ts:85`).
- **Home fan-out.** Home issues one request per shelf and per genre (`useHomeRows.ts:22-24`).

**User impact.** Fine at hundreds of titles. Likely sluggish browsing, high memory and noisy scans at 5k–50k [inferred].

**Recommendation.**
- Virtualise the grid (a windowed grid with fixed tile sizes; there is no heavy dependency to add if a small in-house window is written).
- Refetch only page 1, or invalidate on scan completion only.
- Add indexes `movies(imdb_id)`, `movies(metadata_source, provider_id)` and `movies(metadata_media_type, season, episode)`.
- Cache filter options and the recommendation pool, invalidated on scan or match.

**Implementation scope:** client grid and hooks; migration 021; `movieRepository`; `recommendationService`.

**Complexity:** Medium.

**Verification:** Proposed benchmark:
1. Seed 1k, 10k and 50k synthetic rows with a script against a scratch DB.
2. Measure `GET /api/movies` p95, filter options, and detail + recommendations p95 with autocannon.
3. In the browser, measure scroll FPS and heap at 10k loaded items.
4. Measure network request counts during a 2-minute scan.

---

### AUD-021 — Graceful shutdown only happens when mDNS advertising is on

- **Category:** Reliability
- **Priority:** P2
- **Affected platform:** Backend
- **Classification:** Confirmed defect (code)
- **Confidence:** High (code); not runtime-verified

**Current behavior.** The SIGINT/SIGTERM handlers are registered *inside* `if (config.advertise)` (`packages/server/src/index.ts:10-17`). With `advertise: false`, a stop signal kills the process without `app.close()`, so `hlsSessions.shutdown()`, scheduler stop and DB close never run. The runtime agent could not deliver Ctrl+C inside the harness. On a hard kill, ffmpeg children died within 1 s (probably EPIPE), and the next start cleaned the temp root.

**Problem.** It is an easy mistake with real consequences: WAL checkpoint skipped, ffmpeg orphans possible on platforms where EPIPE doesn't terminate them, and in-progress scans left `running` until the next boot.

**Recommendation.** Register signal handlers unconditionally. Stop discovery only when it was started. Close the DB after `app.close()`.

**Complexity:** Low.

**Verification:** Run a test process with advertise false, send SIGTERM, and assert the `onClose` hooks ran (spy) and no ffmpeg child remains.

---

### AUD-022 — Stream keys are permanent, per-title, logged, and embedded in Host-reflected playlists

- **Category:** Security
- **Priority:** P2
- **Affected platform:** Backend, all clients
- **Classification:** Security vulnerability (low–moderate)
- **Confidence:** High

**Current behavior.**
- The key is `HMAC(stream_secret, "stream:<id>")`, truncated to 32 characters (`accessPinService.ts:67-80`). It is identical for every device and profile and never expires until the PIN changes.
- It appears in stream, subtitle, HLS segment and M3U URLs and Android intents.
- [runtime] The key was written to the server log through Fastify's request URL logging (14 occurrences for one key).
- [runtime] The M3U origin is built from the `Host` header (`routes/stream.ts:21`). `Host: evil.example` was reflected into the playlist together with the key.

**User impact.** Anyone who sees a log, a shared M3U or a screenshot of a VLC URL has indefinite access to that title. A crafted link could make a victim's VLC send the key to another host.

**Recommendation.**
- Add an expiry, e.g. `key = HMAC(secret, id|exp)` with a 24 h lifetime, renewed on each `/playback` call.
- Redact `key=` in the Fastify request serializer.
- Build M3U origins from the server's known LAN addresses (`serverInfoService`) instead of `Host`.

**Complexity:** Low–Medium.

**Verification:** Unit tests: an expired key gives 401. Log redaction test. A forged Host is not reflected.

---

### AUD-023 — Web empty, loading and error states mislead in common cases

- **Category:** UX
- **Priority:** P2
- **Affected platform:** Web
- **Classification:** UX problem / Confirmed defect
- **Confidence:** High

**Current behavior [runtime unless noted].**
- **Wrong empty state for search.** A library search with no hits ("zzzz") shows the *First-time setup / Build your library* onboarding card, while the count line says "Showing 0 matching titles".
- **A default filter that can't be cleared.** [code] `availability: 'available'` is the default, but it counts as an active filter and shows as a chip that "Clear filters" can't remove (`LibraryFilters.tsx:51,74`, `useLibraryViewState.ts:7`).
- **Stale scan status.** Recent scans keeps "running 1 files" after the "Scan finished" toast, until reload.
- **Blank tiles.** [code] A broken poster URL leaves an invisible tile: `PosterImage.tsx` has no `onError`.
- **Endless skeleton.** [code] Settings shows a skeleton forever on fetch error (`SettingsPage.tsx:60`), and "No LAN address detected." shows while still loading (`:187`).
- **Blank screen while retrying.** [code] PinGate and ProfileGate render nothing while queries retry three times (`main.tsx:10` has no QueryClient defaults).
- **No 404 page.** [code] Unknown routes render an empty page.
- **Unavailable titles on Home.** An unavailable (deleted) title appears in "Recently added".
- **Stale draft on another title.** [code] The title-override draft carries over when navigating to another title via Play next or "More like this" (`MovieDetailPage.tsx:37, 50-53, 72`).
- **Stacked dialogs.** [code] Escape closes stacked dialogs together (`Modal.tsx:59-64`).

**User impact.** Users are told to "set up" an already-configured library, see stale state, and in the draft case can save the previous title's draft onto another title.

**Recommendation.** These are each small, targeted fixes. Group them into one polish pass, with a component test for each empty state.

**Complexity:** Low.

**Verification:** Component tests per state. Rerun the runtime steps listed above.

---

### AUD-024 — Web accessibility gaps

- **Category:** Accessibility
- **Priority:** P2
- **Affected platform:** Web
- **Classification:** UX problem
- **Confidence:** High

**Current behavior.** The basics are good: named landmarks, labelled icon buttons, native `<dialog>`, visible focus ring, reduced motion and `lang` [runtime]. The gaps:

- [runtime] The PIN, Confirm PIN and add-profile PIN inputs have no accessible name.
- [runtime] Colour swatches are named "Color 1…6".
- [runtime] Inline errors such as "PINs don't match." are not announced.
- [runtime] There is no skip link, and Library and Home have no `<h1>`.
- [runtime] `document.title` is "OttLib" on every route.
- [runtime] Mobile touch targets are small: card "Mark as watched" is 24×24 px, "See all" is 41×20 px, and nav links are 32 px high.
- [code] The `role="menu"` widgets have no arrow-key support or focus return (`PlayMoreMenu.tsx:24-25`, `TrackMenu.tsx:32-34`, `ProfileMenu.tsx:37`).
- [code] The Up Next countdown is `aria-live` and announces every second (`UpNextOverlay.tsx:20`).
- [code] Light-theme accent contrast is about 3.6:1 (`styles.css:25,27`).

**Recommendation:**
- Label the inputs.
- Name the swatches by colour.
- Add `role="alert"` to errors.
- Set a per-route `document.title`.
- Raise touch targets to 44 px.
- Use buttons with `aria-expanded` instead of `role=menu`, or implement the menu pattern fully.
- Announce the countdown once.

**Complexity:** Low.

**Verification:** An axe-core pass in a jsdom component test or Playwright, plus a manual screen-reader check of sign-in and the player.

---

### AUD-025 — Tests protect units well but not the journeys that broke

- **Category:** Testing
- **Priority:** P2
- **Affected platform:** All
- **Classification:** Testing gap
- **Confidence:** High

**Current behavior.**
- [runtime] Results: server 386 of 388 pass. The 2 failures are timeouts that pass when rerun alone (`playbackHandoff.test.ts` "play-local…", `transcodeSessionService.test.ts` "stops ffmpeg 150 segments ahead…"). Client 144/144, shared 11/11, Android 121/121.
- [code] The real-ffmpeg suites (`hlsRealFfmpeg.test.ts:16-17, 36`, `embeddedSubtitleService.test.ts:119-120`) `skipIf` ffmpeg is absent, and CI installs no ffmpeg (`.github/workflows/ci.yml`). The end-to-end HLS path is therefore probably untested on PRs.
- [code] Coverage gaps:
  - The TV module has **zero** tests. Mobile has one (`SeekMathTest`).
  - There are no Compose UI, instrumentation or E2E tests.
  - There are no `scanService` or `schedulerService` tests.
  - There are no multi-profile contract fixtures (AUD-002).
- [code] There is no lint or static analysis (ESLint, ktlint, detekt) and no Android lint in CI. Running lint locally failed offline because the lint artifact isn't cached [runtime].

**Problem.** The highest-impact defects found here (AUD-002, -005, -006, -007, -009, -011) are all cross-component behaviours the current unit tests can't see.

**Recommendation.** See section H for the specific tests. Install ffmpeg in the CI web job (`apt-get install ffmpeg`, or use the bundle script) so the real-ffmpeg suites run. Raise the two flaky tests' timeouts or run them in a separate non-parallel project.

**Complexity:** Medium overall.

**Verification:** CI log shows the real-ffmpeg suites executed (not skipped).

---

### AUD-026 — Every server error becomes HTTP 400 with its raw message

- **Category:** Architecture / API
- **Priority:** P3
- **Affected platform:** Backend, all clients
- **Classification:** Architecture concern
- **Confidence:** High

**Current behavior.** `app.setErrorHandler` sends `400 {error: error.message}` for anything except `ProfileError` (`app.ts:133`). The consequences:

- Fastify's own 413/415 become 400.
- ffmpeg failures become 400, or 500 with stderr, which includes paths (`hls/ffmpegProcess.ts:150-151`, `routes/hls.ts:22`).
- "No working encoder" and "no duration" become 400 (`transcodeSessionService.ts:91, 93, 179`).
- [runtime] `POST /api/folders` with a missing path returns the raw `ENOENT: … stat 'C:\nonexistent-dir-xyz'`, which works as a filesystem existence oracle.

**User impact.** Clients can't distinguish their own mistakes from server faults (Android shows the raw text, `LoadState.kt:15`). Absolute paths leak to clients.

**Recommendation.** Use typed errors (`BadRequest`, `NotFound`, `Unavailable`) that map to 400, 404 and 503 with stable `code` values. Default to 500 with a generic message, and log the detail server-side. Add an error-body fixture to the contract.

**Complexity:** Low–Medium.

**Verification:** Route tests for representative errors. A Kotlin fixture test for the error shape.

---

### AUD-027 — LAN hardening gaps: non-expiring sessions, no TLS option, simple-request CSRF, any Host accepted

- **Category:** Security
- **Priority:** P3
- **Affected platform:** Backend
- **Classification:** Security vulnerability (low)
- **Confidence:** High

**Current behavior.**
- **Sessions.** Access and profile sessions never expire (`db/migrations/015_access_pin.ts:8-11`, `profileSessionRepository.ts:13-16`). The cookie has `Max-Age` of one year and no `Secure` flag (`routes/sessionCookie.ts:18`).
- **Network.** The server binds `0.0.0.0` with no TLS option (`index.ts:9`).
- **CSRF.** [runtime] On a no-PIN install, a body-less `POST /api/scan` carrying `Origin: http://evil.example` returned 200 and started a scan. The same applies to `metadata-refresh` (all titles), `backfill-auto-accept` and `torrents/connection/test` (`routes/library.ts:29-36`, `torrents.ts:17`).
- **DNS rebinding.** [runtime] Any `Host` header is accepted, which makes rebinding from a malicious web page feasible on no-PIN installs.
- **Headers.** No security headers are sent (no CSP, `X-Frame-Options` or `nosniff`).

**Threat model.** An attacker needs the victim to visit a malicious page while on the LAN, or needs to be on the LAN. The impact is limited to triggering work, reading the library, or (with AUD-003) changing settings.

**Recommendation.**
- Reject state-changing requests whose `Origin` is present and not one of the server's own origins.
- Validate `Host` against `localhost`, the LAN IPs and the server name.
- Give sessions a sliding 90-day expiry.
- Add `X-Content-Type-Options: nosniff` and `frame-ancestors 'none'`.

A TLS option is optional for this scope. Document a reverse-proxy recipe instead.

**Complexity:** Low.

**Verification:** Route tests for an Origin mismatch giving 403 and a foreign Host giving 421 or 403.

---

### AUD-028 — Re-adding a removed library folder fails

- **Category:** Library management
- **Priority:** P3
- **Affected platform:** Backend, Web
- **Classification:** Confirmed defect
- **Confidence:** High (code)

**Current behavior.** Removing a folder only sets `enabled = 0` (`folderRepository.ts:22`). Adding it again runs a plain `INSERT` (`folderRepository.ts:17-20`) against `folders.path UNIQUE` (`migrations/001_initial.ts:4`). The constraint violation then surfaces as a 400 with the SQLite message (AUD-026).

**User impact.** "I removed my Movies folder by mistake and can't add it back."

**Recommendation.** Make `create` an upsert that re-enables the folder and clears `missing` on its rows at the next scan.

**Complexity:** Low.

**Verification:** Route test: add, remove, add again, expect 201 and the same id.

---

### AUD-029 — Android TV detail page shows mojibake for "Watched"

- **Category:** Visual polish
- **Priority:** P3
- **Affected platform:** Android TV
- **Classification:** Confirmed defect
- **Confidence:** High

**Current behavior.** `tv/src/main/kotlin/dev/ottlib/tv/ui/details/DetailsScreen.kt:147` contains `Text("âœ“ Watched")`. These are the UTF-8 bytes of ✓ decoded as Latin-1. It is the only such occurrence in `apps/android`.

**User impact.** Every watched title on TV shows garbage characters, which is visible at 10-foot distance.

**Recommendation.** Replace with `"✓ Watched"` or an icon. Add an `.editorconfig` with `charset = utf-8`.

**Complexity:** Low.

**Verification:** Visual check on the TV details screen.

---

### AUD-030 — Mobile player edge cases

- **Category:** Android mobile UX
- **Priority:** P3
- **Affected platform:** Android phone/foldable
- **Classification:** UX problem / Needs verification on device
- **Confidence:** Medium

**Current behavior (code).**
- **Subtitles Off hides forced subtitles.** "Off" in the in-player track panel disables the whole TEXT track type (`mobile/ui/player/TrackPanel.kt:70-75`), so forced subtitles disappear too. Settings promises "Off (forced subtitles still show)" (`mobile/ui/settings/SettingsScreen.kt:67`).
- **Edge gestures conflict with system back.** Gesture zones exclude only the top and bottom 32 dp (`PlayerGestures.kt:47, 108`), and there is no `systemGestureExclusion` anywhere. Left and right edge swipes can trigger both brightness/seek and system Back [inferred].
- **External player starts from zero.** The external-player handoff passes no start position (`core/presentation/ExternalPlayer.kt:12-16`), and a chooser always resolves, so the "No other video player is installed" toast is unreachable (`ExternalPlayer.kt:18-21`).
- **Pending seek discarded.** A double-tap seek made within 700 ms of leaving the player is dropped (`TouchSeeker.kt:33`).
- **No background media service.** There is no `MediaSessionService` or foreground service, so audio-only background playback and lock-screen controls outside PiP are unavailable. This may be intended.

**What works (runtime, on the preinstalled v0.2.0 build).** Fold and unfold on the Pixel Fold emulator re-laid out the connect screen without restarting the process, which is consistent with the manifest's `configChanges`.

**Recommendation.**
- Select only forced tracks for "Off".
- Add `Modifier.systemGestureExclusion()` to the side gesture zones (or start drags 24 dp in from the edges).
- Pass `position` (ms) and the MX/VLC `position`/`from_start` extras to external players.
- Commit any pending seek on release.

**Complexity:** Low.

**Verification:** Device tests on a gesture-navigation phone and on a Fold (cover ↔ inner) during playback.

---

### AUD-031 — Watch-progress semantics can lose or misstate position

- **Category:** Data integrity
- **Priority:** P3
- **Affected platform:** Backend
- **Classification:** Reliability risk
- **Confidence:** High (code)

**Current behavior.**
- **Arrival order wins.** Progress is last-write-wins by arrival order, with `updated_at` set by the server (`playbackProgressRepository.ts:15-19`). A stale device flushing late overwrites a newer position from another device.
- **Short sessions delete the resume point.** A report under 2 minutes deletes an existing resume point unless it is 0 or the title is in a collection (`playbackProgressService.ts:22-26`). Pressing "Start over" and quitting at 0:40 erases a 1:10:00 resume point. The comment at `config/defaults.ts:44-49` says such opens are "not saved", but the code deletes.
- **Client-trusted duration.** `durationMs` comes from the client and isn't checked against probe data (`playbackProgressService.ts:15-17`), so a wrong duration can mark a title watched at 92%.

**Recommendation.**
- Ignore updates whose client timestamp is older than the stored one, or only overwrite when the session id matches the last writer.
- Keep the old resume point unless the new position is beyond 2 minutes or the user explicitly chose Start over.
- Clamp duration to the probed duration.

**Complexity:** Low.

**Verification:** Service tests for each case.

---

### AUD-032 — Release and update chain hardening

- **Category:** Security / Release
- **Priority:** P3
- **Affected platform:** CI, Android update
- **Classification:** Architecture concern
- **Confidence:** High (code)

**Current behavior.**
- **Release workflow.**
  - `contents: write` is granted at workflow level, so it applies to the build jobs that run `npm ci`, download ffmpeg and run Gradle (`.github/workflows/release.yml:22-23`).
  - Actions are pinned by tag (`softprops/action-gh-release@v2`, `:194`).
  - Signing secrets are present in the test step's environment (`:108-113`).
- **Update verification.** The Android updater verifies SHA-256 against `SHA256SUMS` from the *same* release (`core/update/ApkDownloader.kt:17-19, 44-48`), so it checks integrity, not authenticity. The real guarantee is Android's signature match at install, plus `SigningCheck.kt`.
- **Version-code collision.** Version codes are `major*10000 + minor*100 + patch` (`ReleaseVersion.kt:14`, `release.yml:53`), so 1.0.100 equals 1.1.0.
- **Release-only failures.** R8 and release builds run only at tag time (`ci.yml:63-66`), so minify breakage appears after tagging.

**Recommendation.**
- Scope `contents: write` to the publish job.
- Pin actions by SHA.
- Move signing env to the assemble step only.
- Optionally sign `SHA256SUMS` (minisign) with the public key embedded in the app.
- Reject `minor` or `patch` ≥ 100 in the version job.
- Add a weekly `assembleRelease` CI job.

**Complexity:** Low.

**Verification:** Workflow review; a dry-run release on a fork.

---

### AUD-033 — HLS segments accumulate in the OS temp directory without a global cap

- **Category:** Reliability
- **Priority:** P3
- **Affected platform:** Backend
- **Classification:** Needs verification
- **Confidence:** Medium

**Current behavior.** Segments are written to `os.tmpdir()/ottlib-hls` unless `OTTLIB_TRANSCODE_DIR` is set (`config/transcode.ts:65`). Up to 150 segments ahead of the last request are kept, and segments more than 30 behind are deleted (`hlsSession.ts:148, 184-190`). With 6 remux sessions of high-bitrate 4K, that is potentially tens of GB on the system drive [inferred]. There is no free-space check.

The runtime agent also noted that `start()` empties that root at boot (`transcodeSessionService.ts:72-77`). Two server instances on one machine sharing the default root would wipe each other's sessions.

**Recommendation.**
- Default the root to `<data>/transcode`.
- Check free space before opening a session (503 with a clear message).
- Lower the read-ahead for remux, which is cheap to regenerate.
- Use a per-instance subfolder (port or pid).

**Complexity:** Low.

**Verification:** Run a long 4K remux, measure peak disk use, and simulate low disk.

---

### AUD-034 — Windows "play on this PC" fallback passes the path through `cmd /c start`

- **Category:** Security
- **Priority:** P3
- **Affected platform:** Backend (Windows, loopback only)
- **Classification:** Needs verification
- **Confidence:** Low–Medium

**Current behavior.** When VLC isn't found, `LocalLaunch.open` spawns `cmd.exe /d /s /c start "" <path>` (`providers/playback/localLaunch.ts:17`). Node quotes arguments only when they contain spaces or quotes. A library filename containing `&`, `|` or `^` and no spaces could reach `cmd` unescaped [inferred]. The route is loopback-only (`routes/playback.ts:9-13`) and needs a crafted filename inside a library folder.

**Recommendation.** Replace the call with `explorer.exe <path>` or `ShellExecute` via PowerShell `Start-Process -LiteralPath`, or escape `cmd` metacharacters with `^`.

**Complexity:** Low.

**Verification:** A unit test on the spawn arguments for `a&calc.mp4`, plus a manual test on Windows.

---

### AUD-035 — Documentation and launcher drift

- **Category:** Docs / Operations
- **Priority:** P3
- **Affected platform:** Distribution
- **Classification:** Confirmed defect
- **Confidence:** High

**Current behavior.**
- `FEATURES.md:69-70` says "No transcoding" and "No phone/iOS app yet". Both are false.
- `FEATURES.md:3` cites a local path under `C:\Users\…\.claude\plans`.
- `docs/install.md:46` says the launcher reports a missing ffmpeg or ffprobe, but only `start.sh` does; `scripts/bundle/start.bat:24` is silent.
- Upgrade instructions say to copy `data/` without saying to stop the server first, although WAL files matter.
- `FEATURES.md` doesn't mention subtitles, profiles or shelves.
- The Vite dev proxy targets port 8080 while the server defaults to 8081 (`client/vite.config.ts:4`, `configStore.ts:7`).

**Recommendation.** Refresh `FEATURES.md`. Add a missing-ffmpeg warning to `start.bat`. Add "stop the server before copying data" to the upgrade steps. Align the dev proxy port.

**Complexity:** Low.

---

### AUD-036 — Discovery trusts any advertiser and sends the PIN over cleartext

- **Category:** Security
- **Priority:** P3
- **Affected platform:** Android
- **Classification:** Security vulnerability (low)
- **Confidence:** High (code)

**Current behavior.** Any host advertising `_ottlib._tcp` is listed (`core/discovery/ServerDiscovery.kt:19-27`). Same-named instances overwrite each other (`:24`). The PIN and token go over plain HTTP to whichever entry the user picks (`ConnectionManager.kt:52-58`), because cleartext is allowed app-wide (`network_security_config.xml:7`).

**Threat model.** A LAN attacker advertises "OttLib" and the user picks it, so they must already be on the LAN and win the user's choice.

**Recommendation.**
- Pin the server identity on first connect: the server generates a random `serverId`, published in TXT and `server-info`.
- Warn if a saved server's id changes.
- Show the IP next to each discovered name.

**Complexity:** Low.

---

### AUD-037 — Artwork failures abort metadata saves; superseded artwork is never deleted

- **Category:** Reliability
- **Priority:** P3
- **Affected platform:** Backend
- **Classification:** Reliability risk
- **Confidence:** High (code)

**Current behavior.**
- **A failed download fails the match.** A network error or timeout during artwork download throws (`posterCacheService.ts:18`), so `applyMetadata` never runs (`metadataMatchService.ts:317-320`). One CDN hiccup means "match failed".
- **Old artwork stays on disk.** A refresh with changed art writes a new hashed file (`posterCacheService.ts:25`) and never removes the old one.
- **Backdrops duplicated per episode.** Show backdrops are stored once per episode (key includes `s#e#`, `metadataMatchService.ts:316-318`).
- **Unbounded reads.** The response body is read fully with no size cap (`posterCacheService.ts:23`).

**Recommendation.**
- Save metadata even when artwork fails (retry artwork later).
- Delete the previous file on successful refresh.
- Key backdrops by show.
- Cap the size at about 10 MB.

**Complexity:** Low.

---

## E. Platform-Specific Assessments

### 1. Backend

**Strengths:**
- Layering as documented.
- Every request body is validated with zod.
- Parameterised SQL throughout. Dynamic fragments are whitelisted (`movieRepository.ts:338-367`).
- WAL, `busy_timeout` and foreign keys are on (`db.ts:28-30`).
- Scans can't overlap, and abandoned runs are failed on boot (`app.ts:103`).
- Good provider abstractions.

**Weaknesses:**
- Data-directory exposure (AUD-001).
- No owner tier (AUD-003, -004).
- Path-based identity (AUD-006).
- Fire-and-forget background work without top-level catches (AUD-019).
- Shutdown only under `advertise` (AUD-021).
- A uniform 400 error mapping (AUD-026).

**Maintainability:**
- `movieRepository.ts` (452 lines) mixes filtering, pagination, DTO mapping, duplicate rules, metadata state transitions and torrent matching across several tables. It is the one clear split candidate under `AGENTS.md`.
- Several routes call repositories directly (`routes/library.ts:26-86`, `playbackProgress.ts:11-15`, `scan.ts:7-8`), contrary to the layering rule.
- `app.ts:103-123` packs dozens of statements per line, which is hard to review.

### 2. Web

**Strengths:**
- Small, focused files (none over 200 lines).
- Hooks per resource.
- URL-persisted library state.
- Good modal and focus basics.
- A thoughtful player: hls.js loaded only when needed, a resume chip, Up Next, keep-alive with reopen-on-failure.

**Weaknesses:**
- No virtualization (AUD-020).
- Misleading empty states (AUD-023).
- No buffering or retry UX (AUD-018).
- Per-device hides that contradict the profile copy (AUD-016).
- Capability probe mismatch (AUD-011).
- Density over readability: one-line components over 2,000 characters (`ScanStatusBanner.tsx:53`).
- Five separate poster-tile implementations.
- Data fetching inside components in places (`SettingsPage.tsx:37-38`, `PlayMoreMenu.tsx:51-56`), which `AGENTS.md` discourages.
- No route-level code splitting.

### 3. Android TV

**Strengths:**
- The interaction model is genuinely TV-native:
  - Rows with a pivot scroll.
  - Initial focus on every screen, with focus restore via `lastFocus` / `lastFocusedId`.
  - Remote seek with hold-to-scrub.
  - OK-to-pause and long-press OK for picture options.
  - Back closes the controller before leaving.
  - 48 dp safe-area padding.
  - Watch Next publishing with a deep link.
  - A correct leanback manifest.
- [runtime, on a phone AVD only] The initial focus and D-pad traversal on Connect worked with a clear focus state.

**Weaknesses:**
- Keeps playing in the background (AUD-008).
- No profiles (AUD-002).
- No keep-alive (AUD-009).
- Mojibake (AUD-029).
- No custom audio/subtitle picker; it relies on Media3's CC and settings buttons, which are small on a 10-foot UI.
- No in-player "Next episode" button.
- Posters have no placeholder (`PosterCard.kt:61`).
- Zero tests.
- Not verified: launcher banner, Watch Next on a real launcher, overscan, voice search.

### 4. Android phone

**Strengths:**
- Width-class layouts via `NavigationSuiteScaffold`.
- A complete gesture set.
- PiP with auto-enter on Android 12+.
- Audio focus and becoming-noisy handling.
- The player in a ViewModel survives rotation.
- Immersive fullscreen with transient bars.

**Weaknesses:**
- AUD-030 (forced subtitles, edge gestures, external resume).
- No background media service.
- Raw exception text on Connect [runtime] (AUD-017).
- Only one unit test.

### 5. Android foldable

**Strengths:**
- `configChanges` covers fold, unfold, rotation and resize.
- Tabletop split is based on posture and hinge position, with a 25–75 % guard (`TabletopSplit.kt:15-26`).
- The cover screen is handled through the Compact width class rather than device checks, as `AGENTS.md` requires.
- [runtime, preinstalled v0.2.0 build] Fold and unfold re-laid out the UI with no process restart.

**Not verified:**
- Playback continuity across fold, tabletop transitions during playback.
- Split-screen.
- This worktree's build on a Fold (installation was blocked by a newer release already on the AVD).

### 6. Streaming pipeline

**Strengths:**
- Correct Range handling for single ranges [runtime]. Multi-range answers 416, which is acceptable.
- HEAD support.
- A fast and robust remux/transcode design [runtime]: first segment in 0.3–0.6 s, far-seek in about 0.7 s.
- Hardware encoders with probing.
- libplacebo tone-mapping [runtime].
- Bounded concurrency with a clear 503 `TRANSCODE_BUSY`.
- Per-device session replacement.
- Safe ffmpeg spawning.

**Weaknesses:**
- The non-Latin-1 header bug (AUD-007).
- Capability mismatches (AUD-011).
- Avoidable re-encodes (AUD-014).
- DV profiles (AUD-015).
- No conditional requests (`If-Range` ignored, so a changed file can be spliced mid-download by range clients) [runtime].
- `bytes=0x10-20` parsed as hex [runtime], which is harmless.
- `GET /playback` with capability params eagerly spawns ffmpeg, so a client looping it exhausts slots (state change on GET).
- Single rendition, no ABR. That is acceptable on a LAN, but the web client never sends `maxHeight`, so weak Wi-Fi clients get source-resolution transcodes.
- Image subtitles only via burn-in.

### 7. Cross-platform contracts

**Strengths:**
- One zod source.
- Strict Kotlin decoding in tests (`ignoreUnknownKeys = false`) with lenient decoding at runtime.
- Fixtures fail CI when stale (`toMatchFileSnapshot`).
- Enum-like fields are Strings in Kotlin, so a new server value doesn't crash.

**Weaknesses:**
- Fixtures cover only the single-profile, happy-path world.
- No error bodies.
- No profiles, hides or settings fixtures.
- The scan "idle" body has no zod schema.
- `apiVersion` isn't bumped for behavioural changes (AUD-002).
- The app refuses *any* version mismatch, newer or older (`ConnectionManager.kt:38-40, 70-74`). That is safe, but it forces lock-step upgrades. A min/max supported range would let an older app keep working against a compatible newer server.
- `MediaItems.kt:21` treats any unknown `kind` as a direct file.

---

## F. Feature Opportunity Matrix

| Feature | Current status (verified) | User value | Complexity | Priority |
|---|---|---|---|---|
| Profiles on Android (picker, PIN, header) | Not implemented | High | Medium | P0 (AUD-002) |
| Owner/admin role for server-wide actions | Partial (profile admin only) | High | Medium | P1 (AUD-003) |
| Show → season → episode model + pages | Not implemented | High | High | P1 (AUD-010) |
| Offline SxxEyy / multi-episode / specials parsing | Not implemented | High | Low | P1 (AUD-010) |
| Rename/move tracking (file identity) | Not implemented | High | Medium | P1 (AUD-006) |
| Locked manual matches | Not implemented | Medium | Low | P2 (AUD-013) |
| Per-profile hidden titles in clients | Server only | Medium | Low | P2 (AUD-016) |
| Buffering indicator, Retry, clear failure reasons (web) | Not implemented | High | Low | P2 (AUD-018) |
| Continue Watching progress bar + one-click resume | Partial | Medium | Low | P2 |
| Playback speed, PiP button (web) | Not implemented | Medium | Low | P3 |
| Quality cap for weak Wi-Fi (send `maxHeight` / user setting) | Server-side only | Medium | Low | P3 |
| Missing-episode view per show | Not implemented (needs show model) | Medium | Medium | P3 |
| Collections/franchises from TMDb `belongs_to_collection` | Not implemented (manual shelves exist) | Medium | Medium | P3 |
| Watchlist / favourites | Not implemented (shelves can stand in) | Low–Medium | Low | P3 — shelves already cover it; consider a built-in "My list" shelf per profile instead of a new concept |
| Skip intro / credits | Not implemented | Medium | High (needs detection or markers) | P3 — defer; Up Next at −20 s already covers credits for episodes |
| Editions (Director's Cut, Extended) as versions of one title | Not implemented ("Extended" is stripped and lost) | Low–Medium | Medium | P3 |
| Library health report (unmatched, missing, failed probes, duplicates) | Partial (needs-review filter, scan history) | Medium | Low | P2 — cheap and useful |
| Transcode / session dashboard | Not implemented | Medium | Low | P3 |
| Backup & restore of `data/` | Not implemented | Medium | Low (a "Download backup" that runs `VACUUM INTO` behind the owner gate) | P2 |
| Android background audio / media notification | Not implemented | Low | Medium | P3 |
| Cast / DLNA | Not implemented | Low | High | Not recommended now; M3U + VLC and the native apps cover the use case |
| Adaptive bitrate ladder | Not implemented | Low on LAN | High | Not recommended; a quality cap is the simpler alternative |
| Trickplay / seek thumbnails | Not implemented | Medium | Medium | P3 |
| Docker image / service install | Not implemented | Medium (Linux/NAS users) | Low | P3 |

---

## G. Security and Reliability Findings (summary)

**Trust boundaries as implemented:**
1. *No access PIN:* anything on the network has full control, including credential theft via AUD-001 and AUD-004.
2. *Access PIN set:* anyone who has ever been given the PIN has full control. A session never expires (AUD-027), and the DB download (AUD-001) gives permanent stream keys plus all profile PINs.
3. *Profile PINs:* these protect *personal* data from other profiles via the API, which is verified at runtime (forged headers were rejected and Kid/Home progress stayed isolated). Profile PINs fall to offline cracking via AUD-001.

| Concern | Finding | Notes |
|---|---|---|
| Database + secrets downloadable | AUD-001 | Runtime-confirmed, P0 |
| No owner gate on destructive/global actions | AUD-003 | Runtime-confirmed (system folder added, first-caller PIN) |
| Credential redirect / SSRF via qBittorrent | AUD-004 | Code-confirmed |
| Episodes deletable as "duplicates" | AUD-005 | Data loss, traced |
| History loss on rename/move; cascade on copy delete | AUD-006 | Data loss, code-confirmed |
| Manual corrections overwritten | AUD-013 | Data integrity |
| Progress overwrite / deletion semantics | AUD-031 | Data integrity |
| Shutdown skipped without mDNS | AUD-021 | Reliability |
| Scan aborts / no back-off / unhandled rejection | AUD-019 | Reliability |
| Paused server streams die on Android | AUD-009 | Reliability |
| Stream keys permanent, logged, Host-reflected | AUD-022 | Security (moderate) |
| Error bodies leak paths / FS oracle | AUD-026 | Security (low) |
| CSRF on no-PIN installs, any Host accepted | AUD-027 | Security (low) |
| Rogue mDNS server gets PIN | AUD-036 | Security (low) |
| Release token scope, same-release checksum | AUD-032 | Supply chain (low) |
| Temp-disk growth; shared temp root wiped at boot | AUD-033 | Needs verification |

**Things checked and found sound:**
- SQL injection: all values are bound.
- FFmpeg command injection: argument arrays; hostile names were transcoded safely [runtime].
- Path traversal on `/media`, stream, subtitle and HLS routes [runtime].
- Throttle bypass via `X-Forwarded-For` [runtime].
- `play-local` / `reveal` from LAN with spoofed Host or XFF: 403 [runtime].
- Session token storage (hashed).
- Downloaded-subtitle filename handling and the provider host allow-list.
- CORS: none, so cross-origin reads are blocked [runtime].

**Recovery gaps:** no backup or restore, no "stop server before copying data" guidance (AUD-035), no audit trail for PIN failures, file deletion or settings changes.

---

## H. Test Coverage Gaps

Ranked by the cost of the regression each test would catch.

| # | Test to add | Would have caught / prevents |
|---|---|---|
| 1 | Multi-profile contract fixtures (two profiles, one PIN): `GET /api/profiles`, `select`, and the 409 body; decoded in `ContractFixturesTest` | AUD-002 — Android unusable with profiles |
| 2 | Route test: `GET /media/library.sqlite*` → 404 with and without a session | AUD-001 |
| 3 | Owner-gate route matrix (non-owner gets 403 on settings, folders, scan, file delete, PIN set) | AUD-003/004 regressions once fixed |
| 4 | Scanner integration: scan → progress → rename/move → rescan keeps id and progress | AUD-006 |
| 5 | Duplicate rules: unmatched S01E01/S01E02 are not duplicates; `DELETE /file` → 409 | AUD-005 |
| 6 | `streamService` with CJK, Devanagari and emoji filenames (GET, HEAD, Range) | AUD-007 |
| 7 | Run the real-ffmpeg suites in CI (install ffmpeg); add AC-3-copy and MP3-copy remux cases | AUD-011; the HLS lifecycle in general |
| 8 | Title-parser table of about 40 real release names (years in titles, genre words, numeric titles, editions, multi-episode, specials, `Season N/SxxEyy`) | AUD-012, AUD-010 |
| 9 | Metadata lock: accept → mtime change → rescan → same provider id; dismiss → refresh-all → still dismissed | AUD-013 |
| 10 | `PlayerViewModel` unit tests with fake player and API: keep-alive while paused, reopen-on-404, retry calls `/playback` | AUD-009, AUD-017 |
| 11 | TV lifecycle test (Robolectric or instrumented): `ON_STOP` pauses | AUD-008 |
| 12 | `scanService` tests: unreadable subfolder → warning not failure; cancel; provider 429 back-off; top-level failure finishes the run | AUD-019 |
| 13 | Progress service: stale-timestamp ignore; short session keeps the earlier resume point; duration clamp | AUD-031 |
| 14 | `nativeClient` error-body fixtures (401, 404, 409, 503 `TRANSCODE_BUSY`) | AUD-026 |
| 15 | A thin Playwright smoke test on the built client against a seeded scratch server (sign in, browse, play direct and HLS, resume) | Cross-layer journeys; web regressions like AUD-023 |
| 16 | TV Compose focus tests: initial focus and return-to-poster after Details, for Home, Library and Details | D-pad regressions (0 TV tests today) |
| 17 | Fold/unfold during playback instrumentation test on a foldable AVD (the player stays the same instance and keeps its position) | Foldable continuity, currently unverified |

Already well covered, so don't duplicate: Range parsing units, HLS session caps and races, loginThrottle, profile scoping of progress, decider tables, Matroska cue reading, update checksum mismatch.

---

## I. Quick Wins

Low effort, meaningful benefit. Each is a single small change.

1. **AUD-001:** narrow the `/media/` static root to artwork and subtitle subfolders.
2. **AUD-007:** RFC 5987 `filename*` (or drop `content-disposition`) on streams.
3. **AUD-008:** pause the TV player on `ON_STOP`.
4. **AUD-029:** fix the `âœ“ Watched` mojibake.
5. **AUD-004:** wipe the qBittorrent password when its URL changes; fully mask secrets.
6. **AUD-021:** register signal handlers unconditionally.
7. **AUD-028:** make folder add an upsert that re-enables.
8. **AUD-011:** `+delay_moov` for AC-3 copy, and AAC re-encode for MP3 into fMP4.
9. **AUD-002 stopgap:** owner fallback, or a clear "update the app" signal, for profile-unaware clients.
10. **AUD-009:** Android keep-alive coroutine.
11. **AUD-012:** prefer a bracketed or last year; stop stripping genre words; retry TMDb without the year.
12. **AUD-016:** fix the hide copy now; wire `/api/hides` next.
13. **AUD-023:** correct empty state for zero search results; poster `onError` fallback; Settings error state.
14. **AUD-024:** label the PIN inputs; per-route `document.title`.
15. **AUD-035:** refresh `FEATURES.md`; add the `start.bat` ffmpeg warning.
16. **AUD-025:** install ffmpeg in CI so the real-ffmpeg suites run.

---

## J. Strategic Improvements

These are justified by the current implementation rather than by competitor parity.

1. **File identity and a show model (AUD-006, AUD-010, AUD-005).** Introduce a stable media identity: size + duration + partial hash, with a path that can change. Add `shows` (and optionally seasons) with episodes referencing a show. This removes three classes of data loss and enables show pages, missing-episode views, better artwork and specials. It is the largest change and should be done once, with a careful migration that keeps current ids.
2. **A two-tier authorization model (AUD-003, AUD-004, AUD-027).** "Owner" and "member" on top of the existing profiles; owner PIN required for server-wide actions. Keep the "no PIN = trusted LAN" mode, but make it an explicit first-run choice. This is the minimum that makes profiles meaningful in a household.
3. **A versioned behavioural contract (AUD-002, AUD-026).** Treat `server-info` as a capability handshake (`apiVersion`, `minClientVersion`, `features: [profiles, hides, keepalive]`). Add error and multi-profile fixtures. Have clients accept a version *range*. This prevents a repeat of AUD-002 for every future feature.
4. **Background metadata enrichment queue (AUD-019, AUD-037).** Decouple the fast local walk from provider calls. Add rate limiting, back-off and circuit breakers, plus a "Library health" view of unmatched, errored and missing items. This makes first scans of large libraries practical and gives users visibility.
5. **A playback-recovery layer shared by clients (AUD-009, AUD-017, AUD-018).** The same three behaviours on web and Android: keep-alive, reopen-at-position on session loss, and specific failure messages built from server `reasons`. The web already has half of it, so port the pattern to `core/presentation`.
6. **Capability negotiation by container (AUD-011, AUD-014, AUD-015).** Clients declare progressive *and* MSE/HLS capabilities, codec profiles and DV support. The decider reasons per output container. Add an MP4 keyframe index so remux applies beyond MKV.

---

## K. Recommended Roadmap

### Phase 1 — Stability and correctness

- **Items:**
  - AUD-001 (data-dir exposure)
  - AUD-002 stopgap, then the full Android profile support
  - AUD-007 (non-Latin-1 filenames)
  - AUD-008 (TV background play)
  - AUD-009 (Android keep-alive)
  - AUD-004 (qBittorrent credential redirect)
  - AUD-005 (episode "duplicates" deletion)
  - AUD-021 (shutdown)
  - AUD-028 (folder re-add)
  - AUD-029 (mojibake)
  - AUD-011 server-side part (`delay_moov`, MP3 → AAC)
  - AUD-025's CI ffmpeg install and the tests in section H, rows 1–7
- **Dependencies:** none between most items. Ship the AUD-002 stopgap before the Android profile UI. The section H tests should land with each fix.
- **Expected outcome:**
  - No credential or DB exposure.
  - Android works in multi-profile households.
  - Direct play works for all filenames.
  - No background TV playback.
  - Server-converted streams survive pauses.

### Phase 2 — Playback and platform experience

- **Items:**
  - AUD-003 owner tier, which also completes AUD-004
  - AUD-017 Android recovery (401, IP change, retry via `/playback`, multicast lock)
  - AUD-018 web player feedback and Retry
  - AUD-011 client half (MSE probes)
  - AUD-014 (MP4 keyframes, default-track rule, profile and bit depth)
  - AUD-015 (DV profile)
  - AUD-016 (per-profile hides in clients)
  - AUD-030 (mobile edge cases)
  - AUD-022 (expiring stream keys, log redaction)
  - The TV audio/subtitle picker and an in-player Next button
- **Dependencies:**
  - AUD-003 needs an owner-PIN onboarding step in the web UI.
  - AUD-016 depends on Android profiles (Phase 1).
  - AUD-022 must keep VLC and M3U links working: key lifetime ≥ a long film plus a margin, and renewed on each `/playback`.
- **Expected outcome:**
  - A household-safe permission model.
  - Fewer and clearer playback failures.
  - Consistent behaviour across clients.

### Phase 3 — Product polish

- **Items:**
  - AUD-012 (parser)
  - AUD-013 (locked matches)
  - AUD-019 (scan robustness and the enrichment queue)
  - AUD-020 (virtualised grid, indexes, caching), validated with the benchmark in AUD-020
  - AUD-023 / AUD-024 (empty states, accessibility)
  - AUD-031 (progress semantics)
  - AUD-026 (typed errors and an error contract)
  - AUD-037 (artwork)
  - AUD-035 (docs)
  - Continue Watching progress bars
  - A library health page
  - Backup download
- **Dependencies:**
  - The typed-error work (AUD-026) should precede the Android message mapping refinements.
  - The enrichment queue simplifies the parser and lock changes.
- **Expected outcome:**
  - Accurate libraries with little manual fixing.
  - Smooth browsing at 10k+ titles.
  - Fewer support questions.

### Phase 4 — Advanced capabilities

- **Items:**
  - The show/season model and file identity (Strategic 1; AUD-006 / AUD-010 full fix), with show pages on all three clients and a missing-episodes view
  - TMDb collections
  - Editions as versions
  - Trickplay thumbnails
  - A transcode dashboard
  - Optional background audio on Android
  - A Docker image
- **Dependencies:**
  - The show model needs Phase 3's parser and enrichment queue.
  - It is a schema migration touching every client, so do it behind a capability flag (Strategic 3).
- **Expected outcome:** TV libraries browse like a streaming service, and renames never lose history.

> **Ordering note.** AUD-006 (rename/move loss) and AUD-010 (TV offline) are P1 by impact, but their *proper* fix is the Phase 4 schema work. Phase 1–3 include low-cost mitigations:
> - offline SxxEyy parsing into `parsed_season` / `parsed_episode` (Phase 1 with AUD-005)
> - a "same size + duration" re-link in the scanner (Phase 3)
>
> These remove most of the user-visible damage before the full model lands.

---

## L. Top 20 Recommendations

| Rank | Finding | Description | User impact | Effort | Platforms | Reason for ranking |
|---|---|---|---|---|---|---|
| 1 | AUD-001 | Stop serving the data directory; serve only artwork and subtitle subfolders; rotate the stream secret | Ends credential and PIN-hash exposure | Low | Backend | Highest severity, trivial fix, runtime-confirmed |
| 2 | AUD-002 | Handle profile-unaware clients now; add profiles to Android | TV and phone keep working when profiles are used | Low → Medium | Server, Android | A shipped feature disables two of three clients |
| 3 | AUD-007 | Encode the `content-disposition` filename (RFC 5987) | Direct play for all non-Latin filenames | Low | Backend | Runtime-confirmed, one function, wide impact for Indic/CJK libraries |
| 4 | AUD-008 | Pause on `ON_STOP` in the TV player | No background playback; correct resume points | Low | Android TV | Highly visible, one line |
| 5 | AUD-009 | Android HLS keep-alive + reopen on session loss | Server-converted streams survive pauses | Low–Medium | Android | Breaks exactly the files that needed help |
| 6 | AUD-004 | Wipe stored credentials on URL change; full masking | Prevents qBittorrent password theft | Low | Backend | Exploitable by anyone with API reach |
| 7 | AUD-005 | Never treat different episodes or unknown-year titles as deletable duplicates | Prevents deleting real episodes | Low–Medium | Backend, clients | Irreversible data loss |
| 8 | AUD-003 | Owner tier for server-wide and destructive actions; first-run owner PIN | Kids and guests can't delete files or change settings | Medium | Backend, Web | Makes profiles meaningful; completes #6 |
| 9 | AUD-006 | Re-link moved/renamed files by size + duration (later: full file identity) | History, matches and shelves survive reorganising | Medium | Backend | Silent, recurring user-data loss |
| 10 | AUD-010 | Offline SxxEyy parsing now; show/season model later | TV libraries usable without TMDb; proper show pages | Low → High | All | Headline capability currently provider-dependent |
| 11 | AUD-011 | Container-aware audio copy; `delay_moov`; explicit "ffmpeg missing" | Fewer unexplained web playback failures | Low–Medium | Backend, Web | Runtime-confirmed failures |
| 12 | AUD-025 | Run real-ffmpeg tests in CI; add section H tests 1–7 | Prevents recurrences of the above | Medium | CI | Most high-impact defects were invisible to current tests |
| 13 | AUD-017 | Android 401 handling, IP re-discovery, friendly errors, retry via `/playback` | Self-healing after routine network or PIN events | Medium | Android | Frequent "it stopped working" moments |
| 14 | AUD-018 | Web buffering indicator, Retry, specific failure reasons | Users can tell slow from broken and recover | Low–Medium | Web | Core playback UX |
| 15 | AUD-013 | Lock manual matches; OMDb year-aware scoring | Fixes stay fixed | Low–Medium | Backend | Protects user effort |
| 16 | AUD-012 | Parser fixes (years, genre words, numeric titles) + year-less TMDb retry | Correct matches for common titles | Low | Backend | Cheap accuracy gain |
| 17 | AUD-016 | Per-profile hides in all clients | Hidden titles behave as the UI promises | Low–Medium | Web, Android | Settings copy currently misleads |
| 18 | AUD-014 | MP4 keyframe index; default-track rule; profile/bit-depth caps | Less transcoding, better quality, fewer 10-bit failures | Medium | Backend | Efficiency and correctness on common files |
| 19 | AUD-021 | Unconditional graceful shutdown | Clean WAL checkpoint, no orphans | Low | Backend | Trivial and prevents rare corruption |
| 20 | AUD-020 | Virtualised grid, indexes, cached filter options, page-1-only refetch during scans | Large libraries stay fast | Medium | Web, Backend | Needed before libraries reach thousands of titles; benchmark first |

---

## M. Verification Limitations

**Environment.**
- Windows 11, Node 24.16, ffmpeg `2024-01-01-git-e1c1dc8347` (not the bundled `autobuild-2026-10-23`), JDK 17, Android SDK.
- The worktree has no `node_modules`. Dependencies resolved from the parent checkout. `@ottlib/shared` resolved to the *main checkout's* prebuilt `dist` (same commit `19c465d`; source differs only in line endings). Server and client source ran from the worktree.

**Not verified:**
- **Metadata providers.** No TMDb or OMDb key and no network calls to providers: matching quality, artwork, episode metadata, rate-limit behaviour and the match-review UI. TV detail/Up Next in the web walk-through used *simulated* TV metadata written into a scratch DB.
- **Android TV on a TV.** No Android TV AVD and no device: launcher banner, Watch Next on a real launcher, overscan, D-pad on content screens, voice search, the background-playback behaviour of AUD-008. The TV APK was only launched on a phone AVD (Connect screen focus).
- **Android playback.** No Android client was connected to a server: library, details, player, PiP, gestures, tabletop mode, HDR, Media3 behaviour, progress reporting, keep-alive impact (AUD-009 is code-plus-server-runtime evidence).
- **Foldable.** Fold/unfold was observed only on a preinstalled release build v0.2.0 on the Pixel Fold AVD. This worktree's debug build couldn't be installed over it, and nothing was uninstalled.
- **Release builds.** The R8 release build and its merged manifest (e.g. that the debug-only exported `PreviewActivity` is stripped).
- **Android lint.** The lint artifact wasn't in the offline Gradle cache.
- **Graceful shutdown.** The harness couldn't deliver Ctrl+C. The advertise=true path was not run, to avoid announcing on the user's LAN.
- **Sweep vs live ffmpeg.** The idle sweep killing a *still-running* ffmpeg wasn't observed (sessions finished first). Orphan behaviour on hard kill was inconclusive (children died within 1 s, possibly naturally).
- **Tone-mapping fallbacks.** The CPU `zscale` and OpenCL chains were not exercised (libplacebo was available).
- **HDR visuals.** Visual HDR/DV output quality (AUD-015): no HDR display or DV samples.
- **Browsers.** Only the embedded Chromium was used. MP3-in-fMP4 (AUD-011) wasn't retested in desktop Chrome, Firefox or Safari. Fullscreen and visible subtitle rendering couldn't be confirmed in the pane.
- **Scale.** Performance at 1k–50k titles (AUD-020): no benchmark run; a procedure is proposed.
- **Network faults.** Wi-Fi drop, server IP change and DHCP behaviour on Android were not exercised.
- **Local launch.** `play-local` success from loopback and the `cmd start` metacharacter case (AUD-034), to avoid launching programs on the user's desktop.
- **qBittorrent.** The credential-redirect chain (AUD-004) was verified in code but not executed against a listener.
- **Supply chain.** Third-party library provenance (e.g. `nextlib-media3ext` native FFmpeg in the APKs) and GPL compliance of the bundled ffmpeg: flagged only.

**Corrections made during verification:**
- One runtime note claimed `GET /api/settings` returns secrets in plaintext. Executing `SettingsService.get()` showed they are masked but reveal the last 4 characters (folded into AUD-004).
- One code-reading note claimed the subtitle dialog leaks transcode sessions. `GET /playback` without capability params never opens a session (`routes/playback.ts:22-25`), so that note was discarded.

**Open questions for the owner.** The answers change some priorities.

1. **Is "no PIN = fully trusted LAN" the intended default?** If yes, AUD-027 stays P3. AUD-001 and AUD-004 stay P0/P1 regardless, because they leak *third-party* credentials.
2. **Should profiles be a security boundary for library administration** (a child can't delete files), or only a personalisation feature? This decides how far AUD-003 goes.
3. **Should hidden titles be per profile (as the settings copy says) or per device (as implemented)?** AUD-016 assumes per profile.
4. **Is lock-step app/server versioning acceptable,** or should older Android builds keep working against newer servers? This affects the Strategic 3 design.

---

*End of report.*

