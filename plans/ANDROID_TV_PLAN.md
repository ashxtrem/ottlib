# Ottlib — Android TV Client (Google TV)

> **Status (2026-09-27):** M0–M4 implemented. Verified end to end on an emulator at TV geometry against a copy of the real library (connect, browse, DTS playback via FFmpeg, external SRT, resume, deep link). Still to verify on the real Google TV: mDNS discovery on the home LAN, HDR10/Dolby Vision output, audio passthrough to a receiver, and the Watch Next row.

## Context

Today the TV path is: open a browser on the TV, type the LAN address, D-pad through a web UI designed for mouse/touch, then hand off to an external player via `intent://`. Browser navigation on TV is the pain point. This plan adds a **native Android TV app** that talks to the existing Ottlib server over the LAN and plays files in an **embedded player**.

The server stays the source of truth. The app is a second client, like the web UI — no second database, no sync, no accounts.

**Streaming is unchanged in this phase.** The embedded player reads the same byte-range endpoint (`/api/stream/:id`) that the external players use today. `.m3u` and `intent://` are browser → external-player handoffs; an app with its own player does not need them. Optimizing the stream (remux/transcode/HLS) is Phase 2 and is out of scope here — but the API added below is shaped so Phase 2 can change *what URL the player gets* without an app rewrite.

### Decisions (agreed)

| Decision | Choice |
|---|---|
| Language / UI | Kotlin + Jetpack Compose, Compose for TV (`androidx.tv:tv-material`) |
| Player | AndroidX Media3 (ExoPlayer) |
| Target device | Google TV (Chromecast with Google TV / Google TV Streamer class) |
| Resume position | In scope for v1 |
| Location | Gradle project inside this repo at `apps/android/`; the TV app is a Gradle module (`:tv`) so a phone app can later be a sibling module (`:mobile`) sharing `core` modules |

### Why Media3 direct play is enough for v1

Probed from the current library (657 titles):

| | Breakdown | Media3 on Google TV |
|---|---|---|
| Container | MKV 567 · MP4 88 · AVI 2 | All supported |
| Video | H.264 369 · HEVC 283 · VP9 3 · MPEG-4 ASP 2 | Hardware decode (MPEG-4 ASP: verify) |
| HDR | HDR10 31 · Dolby Vision 14 | Supported on 4K devices; DV profile 7 files fall back to HDR10 base layer at best — verify each |
| Audio | AAC 418 · AC-3 198 · E-AC-3 79 · DTS 6 · TrueHD 4 · Opus 5 · MP3 4 | All native except **DTS/TrueHD** (10 titles) → FFmpeg audio decoder (M4) or "Open in VLC" fallback |
| Subtitles | SRT 300 · ASS 135 · PGS 119 · VobSub 32 · mov_text 12 | All render; **ASS styling is basic** (text only, no karaoke/positioning) |

~98% of titles direct-play with no server work. The remaining edge cases get an explicit **"Open in external player"** escape hatch (the existing `intent://` path) rather than blocking v1 on transcoding.

### Non-goals (v1)

- No admin features in the app: settings, folder management, scanning, match review, torrents stay web-only.
- No transcoding / HLS / bitrate adaptation (Phase 2).
- No auth — same trusted-LAN model as the web UI.
- No Play Store publishing; sideloaded APK.
- No phone or iOS build yet (see "Later").

## Architecture

```
┌────────────── Google TV ──────────────┐          ┌──────── PC (Ottlib server) ────────┐
│  :tv (Compose for TV screens)         │  JSON    │  routes → services → repositories  │
│   └─ core/data ── core/network ───────┼─────────▶│  /api/movies, /api/shelves, ...    │
│   └─ core/player (Media3) ────────────┼─ bytes ─▶│  /api/stream/:id (range)           │
│   └─ core/discovery (NsdManager) ◀────┼─ mDNS ───│  _ottlib._tcp advertisement        │
└───────────────────────────────────────┘          └────────────────────────────────────┘
```

Identity: the app generates a UUID once, persists it, and sends it as `x-device-id` on every API call — exactly like the web client (`useDeviceId.ts`). Watched state and resume position are per-device, consistent with the existing model.

## Server changes (Milestone 0)

All additive; the web client keeps working unchanged. Layering per `AGENTS.md`.

### 1. Resume position

```
packages/shared/src/playback.ts                     # zod: playbackProgressSchema, playbackSourceSchema,
                                                    #      continueWatchingSchema, serverInfoSchema
packages/server/src/db/migrations/013_playback_progress.ts
packages/server/src/repositories/playbackProgressRepository.ts (+ .test.ts)
packages/server/src/services/playbackProgressService.ts        (+ .test.ts)
packages/server/src/routes/playbackProgress.ts
```

```sql
CREATE TABLE playback_progress (
  movie_id    INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  device_id   TEXT    NOT NULL,
  position_ms INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  updated_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (movie_id, device_id)
);
```

- `PUT /api/movies/:id/progress` `{ positionMs, durationMs }` — upsert. Service rules (constants in `config/defaults.ts`, not inline):
  - position < 2 min → ignore (accidental open)
  - position ≥ 92% of duration → delete progress and set watched = true via `WatchStateRepository`
- `GET /api/movies/continue-watching?limit=` — device-scoped, newest first, excludes missing files. Registered before `/api/movies/:id`.
- `resumePositionMs` added (nullable) to the movie detail response for the requesting device.

### 2. Playback source endpoint (the Phase 2 seam)

`GET /api/movies/:id/playback` →

```json
{
  "kind": "direct",
  "streamUrl": "/api/stream/42",
  "durationMs": 7260000,
  "resumePositionMs": 1830000,
  "subtitles": [{ "url": "/api/movies/42/subtitles/10000", "language": "en", "codec": "SRT", "isForced": false }]
}
```

The app never builds stream URLs itself. In Phase 2 the app sends its decoder capabilities and the server may answer `kind: "hls"` with a different URL — the app's player code doesn't change shape. Lives in `playbackService.ts` / `routes/playback.ts`.

### 3. External subtitle serving

External subtitle files are already detected (`externalSubtitleScanner.ts`) but not served — the file name isn't retained. Rather than a migration + backfill:

- `findExternalSubtitleTracks` also returns the resolved file path (internal type, not in the shared `MediaTrack` schema).
- `GET /api/movies/:id/subtitles/:order` resolves the movie via `PlaybackService.movieFile` (existing path/root validation), re-runs the scanner for that one directory, and streams the matching file with the right MIME (`application/x-subrip`, `text/x-ssa`, `text/vtt`). Subtitle MIME map goes in `config/defaults.ts` next to `mimeTypes`.
- Embedded tracks need nothing — Media3 reads them from the container.

### 4. Server info + discovery

- `GET /api/server-info` → `{ name, version, apiVersion, port }` (extend existing `serverInfoService.ts`; new `routes/serverInfo.ts`). The app refuses to connect with a clear message if `apiVersion` is incompatible.
- `services/discoveryService.ts`: advertise `_ottlib._tcp` over mDNS using `bonjour-service` (pure JS), TXT record `{ apiVersion, name }`. Started/stopped from `index.ts`. Toggle via config (`advertise: true` default).
- **Risk:** Windows' own mDNS responder and firewall can interfere. Manual address entry is always available, and the web Settings "Server info" panel already shows the IP:port.

### 5. Contract between TypeScript and Kotlin

`AGENTS.md` says types live once, in `packages/shared`. Kotlin can't import zod, so:

- `packages/shared` stays the **single source of truth**.
- Kotlin DTOs in `core/model` are hand-written for only the endpoints the app uses (~8).
- Drift guard: server route tests write real, zod-validated response bodies to `contract/fixtures/*.json`; a Kotlin unit test decodes every fixture with a **strict** decoder (`ignoreUnknownKeys = false`). A server field change fails the Kotlin test instead of failing silently on the TV. (At runtime the app decodes leniently.)

## Android project (Milestones 1–4)

```
apps/android/
├── settings.gradle.kts / build.gradle.kts / gradle/libs.versions.toml / gradlew
├── core/model/       # @Serializable DTOs (Movie, MovieListItem, Shelf, PlaybackSource, ...)
├── core/network/     # OkHttp + kotlinx.serialization API client, x-device-id interceptor
├── core/data/        # DataStore stores (server URL, device id, playback preferences) + ConnectionManager
├── core/discovery/   # NsdManager wrapper → Flow<List<DiscoveredServer>>
├── core/player/      # Media3 setup, track preferences, ProgressReporter
└── tv/               # Application module: manifest, theme, navigation, screens
    └── ui/{connect,home,library,search,details,player,settings}/
```

Same principles as the TS side: one responsibility per file, ~300–400 line soft limit, screens are presentational with state in a `ViewModel` per screen. ViewModels call the typed `OttlibApi` directly — a repository layer over it would only forward calls. Dependency injection: a manual `AppContainer` (no Hilt) until the `:mobile` module creates a real need.

Key libraries: Compose BOM 2025.10, `androidx.tv:tv-material` 1.0, Navigation Compose, Media3 1.8 (`exoplayer`, `ui`, `datasource-okhttp`), `nextlib-media3ext` (prebuilt FFmpeg decoders for Media3), Coil 3, DataStore, kotlinx.serialization, OkHttp 4 (no Retrofit — the API is eight calls).

Build: AGP 8.13 / Gradle 8.13 / Kotlin 2.2, compileSdk/targetSdk 36, minSdk 28, JDK 17. Gradle wrapper is committed; no global Gradle needed.

### Manifest / platform essentials

- `<uses-feature android:name="android.software.leanback" android:required="true"/>`, touchscreen `required="false"`.
- Launcher activity with `LEANBACK_LAUNCHER` category + 320×180 banner.
- `network_security_config`: allow cleartext (LAN HTTP; Android blocks it by default, and domain-config can't express IP ranges, so base-config).
- `.gitignore`: `apps/android/**/build/`, `.gradle/`, `local.properties`, `*.keystore`, `*.jks`.

### Screens

1. **Connect** — list of mDNS-discovered servers + "Enter address" (numeric keypad, not the soft keyboard). Validates via `/api/server-info`. Remembers the last server and reconnects silently on launch; if unreachable, shows Retry / Change server.
2. **Home** — horizontal rows: Continue watching · Recently added · Unwatched · one row per shelf · a few genre rows (from `/api/movies/filter-options`). Backdrop of the focused title fills the top. Rows are paged with the existing cursor API.
3. **Library** — poster grid with filter chips (watched, genre, quality, sort); reuses `/api/movies` query params 1:1.
4. **Search** — text field (Google TV keyboard also provides voice input) with debounced `/api/movies?search=`.
5. **Details** — backdrop, poster, year/runtime/rating, plot, cast, tech chips (4K, HDR/DV, audio format). Actions: **Resume from 30:30** / **Play from start** / Mark watched / Add to shelf (stretch) / overflow **Open in external player**.
6. **Player** — Media3 `PlayerView` (TV-ready controls) wrapped in Compose.
   - D-pad: center = play/pause, left/right = seek −10/+30 s, up/down = controls; Back saves progress and exits.
   - Audio/subtitle picker dialog; preferred audio and subtitle language from app settings.
   - `ProgressReporter`: PUT progress every 15 s while playing, and on pause/stop/exit.
   - Unsupported-track errors (e.g. DTS before M4) → dialog offering another audio track or the external player.
7. **Settings (app-local)** — server, preferred audio/subtitle language, subtitle size, app version, device ID.

## Milestones

| # | Deliverable | Done when |
|---|---|---|
| **M0** | Server: progress, playback-source, subtitles, server-info, mDNS, contract fixtures | `npm test` green; `curl` confirms each endpoint; web UI unaffected |
| **M1** | Gradle skeleton, TV manifest/banner, Connect screen, device ID, API client | APK installs on the Google TV via `adb`, shows up on the home screen, discovers/connects to the server |
| **M2** | Home rows, Library grid, Search, Details | Library can be browsed with only the remote; posters load fast; focus never gets lost |
| **M3** | Media3 player, track selection, progress + resume, external-player fallback | Full playback-matrix pass (below); resume works across app restarts |
| **M4** | Polish: FFmpeg audio decoder (DTS/TrueHD), Android TV "Watch Next" row integration, frame-rate matching, error/empty states, docs | DTS/TrueHD titles play; in-progress titles appear on the Google TV home screen |

### Playback test matrix (M3)

Pick one real title per row from the library (query `movies` / `media_tracks`):

H.264 MKV · HEVC 1080p · HEVC 4K HDR10 · Dolby Vision · AVI/MPEG-4 ASP · VP9 · AC-3 · E-AC-3 · DTS · TrueHD · SRT embedded · SRT external · ASS · PGS · VobSub · seek to end / resume / auto-watched at 92%.

### Device setup

- Google TV: Settings → System → About → tap *Android TV OS build* 7× → Developer options → enable **USB debugging** / **Wireless debugging**, then `adb connect <tv-ip>:5555`.
- Optional emulator: install a Google TV system image via the SDK Manager (only an Android 36 phone image is installed now). Codec/HDR behavior must be verified on the real device regardless.
- Windows firewall: the server's port (8081) and mDNS (UDP 5353) must be allowed on the **Private** network profile.

## Docs to update

- `AGENTS.md` — Android section: module layout, Kotlin conventions, the contract-fixture rule.
- `FEATURES.md` — "Android TV app" section; move "resume position" and "mobile app" out of *Out of scope for v1*.
- `README.md` — building/installing the TV app.

## Later (not this plan)

- **Phase 2 — streaming**: capability-aware playback (`/api/movies/:id/playback` returns remux/transcode/HLS when direct play won't work), bandwidth for 4K remuxes over Wi-Fi, ASS rendering, alternatives to `.m3u` for the web/LAN path.
- **Android phone** — `:mobile` module reusing `core/*`; only the UI layer is new.
- **iOS** — AVPlayer cannot play MKV (86% of the library). Needs either Phase 2 HLS remuxing or a VLCKit/mpv-based player; decide after Phase 2. Kotlin Multiplatform could share `core/model` + `core/data`.
